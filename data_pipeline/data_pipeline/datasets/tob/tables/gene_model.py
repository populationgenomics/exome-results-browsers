import json
import math

import hail as hl

from google.cloud import bigquery
from google.api_core import exceptions

from data_pipeline.datasets.tob.helpers import CHROM_LENGTHS, MAX_NUM_PARTITIONS

TABLE_SCHEMA = [
    bigquery.SchemaField("gene_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("strand", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("start", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("stop", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("global_start", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("global_stop", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("gencode_gene_symbol", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("canonical_transcript_id", "STRING", mode="NULLABLE"),
    bigquery.SchemaField(
        "canonical_transcript",
        "RECORD",
        mode="NULLABLE",
        fields=[
            bigquery.SchemaField("transcript_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("strand", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("start", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("stop", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("global_start", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("global_stop", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField(
                "features",
                "RECORD",
                mode="REPEATED",
                fields=[
                    bigquery.SchemaField("feature_type", "STRING", mode="REQUIRED"),
                    bigquery.SchemaField("start", "INTEGER", mode="REQUIRED"),
                    bigquery.SchemaField("stop", "INTEGER", mode="REQUIRED"),
                    bigquery.SchemaField("global_start", "INTEGER", mode="REQUIRED"),
                    bigquery.SchemaField("global_stop", "INTEGER", mode="REQUIRED"),
                ],
            ),
        ],
    ),
    bigquery.SchemaField("hgnc_id", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("symbol", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("name", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("previous_symbols", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("alias_symbols", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("search_terms", "STRING", mode="REQUIRED"),
]


def get_features(gencode, reference_genome):
    """
    Filter Gencode table to features and format fields.
    """
    features = gencode.filter(hl.set(["exon", "CDS", "UTR", "start_codon", "stop_codon"]).contains(gencode.feature))
    features = features.select(
        feature_type=features.feature,
        transcript_id=features.transcript_id.split("\\.")[0],
        gene_id=features.gene_id.split("\\.")[0],
        chrom=features.interval.start.contig,
        strand=features.strand,
        start=features.interval.start.position,
        stop=features.interval.end.position,
        global_start=hl.locus(
            features.interval.start.contig,
            features.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            features.interval.end.contig,
            features.interval.end.position,
            reference_genome,
        ).global_position(),
    )

    return features


def get_genes(gencode, reference_genome):
    """
    Filter Gencode table to genes and format fields.
    """
    genes = gencode.filter(gencode.feature == "gene")
    genes = genes.select(
        gene_id=genes.gene_id.split("\\.")[0],
        gene_symbol=genes.gene_name,
        chrom=genes.interval.start.contig,
        strand=genes.strand,
        start=genes.interval.start.position,
        stop=genes.interval.end.position,
        global_start=hl.locus(
            genes.interval.start.contig,
            genes.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            genes.interval.end.contig,
            genes.interval.end.position,
            reference_genome,
        ).global_position(),
    )

    genes = genes.key_by(genes.gene_id).drop("interval")

    return genes


def get_transcripts(gencode, reference_genome):
    """
    Filter Gencode table to transcripts and format fields.
    """
    transcripts = gencode.filter(gencode.feature == "transcript")
    transcripts = transcripts.select(
        transcript_id=transcripts.transcript_id.split("\\.")[0],
        gene_id=transcripts.gene_id.split("\\.")[0],
        chrom=transcripts.interval.start.contig,
        strand=transcripts.strand,
        start=transcripts.interval.start.position,
        stop=transcripts.interval.end.position,
        global_start=hl.locus(
            transcripts.interval.start.contig,
            transcripts.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            transcripts.interval.end.contig,
            transcripts.interval.end.position,
            reference_genome,
        ).global_position(),
    )

    transcripts = transcripts.key_by(transcripts.transcript_id).drop("interval")

    return transcripts


def load_gencode_gene_models(gtf_path, reference_genome):
    gencode = hl.experimental.import_gtf(
        gtf_path,
        reference_genome=reference_genome,
        min_partitions=100,
        skip_invalid_contigs=True,
        force=gtf_path.endswith(".gz"),
    )

    # Extract genes, transcripts, and features from the GTF file
    genes = get_genes(gencode, reference_genome)
    transcripts = get_transcripts(gencode, reference_genome)
    features = get_features(gencode, reference_genome)
    features = features.cache()

    # Annotate transcripts with their features
    transcript_features = features.group_by(features.transcript_id).aggregate(
        features=hl.agg.collect(features.row_value)
    )

    transcripts = transcripts.annotate(
        features=transcript_features[transcripts.transcript_id].features.map(
            lambda f: f.select("feature_type", "start", "stop", "global_start", "global_stop")
        )
    )

    # Annotate genes with their transcripts
    gene_transcripts = transcripts.key_by()
    gene_transcripts = gene_transcripts.group_by(gene_transcripts.gene_id).aggregate(
        transcripts=hl.agg.collect(gene_transcripts.row_value.drop("gene_id", "chrom"))
    )
    genes = genes.annotate(**gene_transcripts[genes.gene_id])
    genes = genes.cache()

    return genes


def load_canonical_transcripts(canonical_transcripts_path):
    # Canonical transcripts file is a TSV with two columns: gene ID and transcript ID and no header row
    table = hl.import_table(canonical_transcripts_path, force=True, no_header=True, min_partitions=100)
    table = table.rename({"f0": "gene_id", "f1": "transcript_id"})
    table = table.select(gene_id=table.gene_id.split("\\.")[0], transcript_id=table.transcript_id.split("\\.")[0])
    table = table.key_by("gene_id")
    return table


def load_hgnc(hgnc_path):
    hgnc = hl.import_table(hgnc_path, min_partitions=100, missing="")
    hgnc = hgnc.select(
        hgnc_id=hgnc["HGNC ID"],
        symbol=hgnc["Approved symbol"],
        name=hgnc["Approved name"],
        previous_symbols=hgnc["Previous symbols"].split(",").map(lambda s: s.strip()),
        alias_symbols=hgnc["Alias symbols"].split(",").map(lambda s: s.strip()),
        gene_id=hgnc["Ensembl gene ID"],
    )
    hgnc = hgnc.filter(hl.is_defined(hgnc.gene_id)).key_by("gene_id")
    return hgnc


def prepare_gene_models_helper(reference_genome, gencode_path, canonical_transcripts_path):
    hl.init()

    # Load genes from GTF file
    genes = load_gencode_gene_models(gencode_path, reference_genome)
    genes = genes.distinct()
    genes = genes.transmute(gencode_gene_symbol=genes.gene_symbol)

    # Annotate genes with canonical transcript
    canonical_transcripts = load_canonical_transcripts(canonical_transcripts_path)
    # pylint: disable=no-value-for-parameter
    genes = genes.annotate(
        canonical_transcript_id=hl.if_else(
            hl.all(
                [
                    hl.is_defined(canonical_transcripts[genes.gene_id].transcript_id),
                    hl.str(canonical_transcripts[genes.gene_id].transcript_id).strip().length() > 0,
                ]
            ),
            canonical_transcripts[genes.gene_id].transcript_id,
            hl.null(hl.tstr),
        )
    )

    # Drop transcripts except for canonical
    genes = genes.annotate(
        canonical_transcript=genes.transcripts.filter(
            lambda transcript: transcript.transcript_id == genes.canonical_transcript_id
        ).head()
    )

    genes = genes.drop("transcripts")

    return genes


def prepare(reference_genome, hgnc_path, gencode_path, canonical_transcripts_path):
    reference_genome = reference_genome.replace("grc", "GRC")
    genes = prepare_gene_models_helper(reference_genome, gencode_path, canonical_transcripts_path)

    # Annotate genes with information from HGNC
    hgnc = load_hgnc(hgnc_path)
    genes = genes.annotate(**hgnc[genes.gene_id])
    genes = genes.annotate(
        symbol=hl.or_else(genes.symbol, genes.gencode_gene_symbol),
    )

    # Collect all fields that can be used to search by gene symbol
    genes = genes.annotate(
        search_terms=hl.str("|").join(
            hl.set(
                hl.empty_array(hl.tstr)
                .append(genes.symbol)
                .append(genes.gencode_gene_symbol)
                .append(genes.gene_id)
                .extend(hl.or_else(genes.previous_symbols, hl.empty_array(hl.tstr)))
                .extend(hl.or_else(genes.alias_symbols, hl.empty_array(hl.tstr)))
                .filter(hl.is_defined)
                .map(lambda s: s.upper())
            ),
        )
    )

    # pylint: disable=no-value-for-parameter
    genes = genes.transmute(
        alias_symbols=hl.if_else(
            hl.all(
                [
                    hl.is_defined(genes.alias_symbols),
                    genes.alias_symbols.length() > 0,
                ]
            ),
            hl.str("|").join(genes.alias_symbols),
            hl.null(hl.tstr),
        ),
        previous_symbols=hl.if_else(
            hl.all(
                [
                    hl.is_defined(genes.previous_symbols),
                    genes.previous_symbols.length() > 0,
                ]
            ),
            hl.str("|").join(genes.previous_symbols),
            hl.null(hl.tstr),
        ),
    )

    dataframe = genes.to_pandas(flatten=False)
    dataframe.canonical_transcript = dataframe.canonical_transcript.apply(row_to_dict)

    # GCP only supports new line delimited JSON files, so we will need to write one record per line.
    tmp_file = "/tmp/gene_models.ndjson.gz"
    dataframe.to_json(tmp_file, orient="records", lines=True)

    print(f"Output saved to {tmp_file}")
    return tmp_file


def row_to_dict(record):
    if record["transcript_id"] is None and record["features"] is None:
        return None

    record = dict(record)

    for value in record.values():
        assert value is not None

    if record["features"] is not None:
        record["features"] = [dict(r) for r in record["features"]]

        for feature in record["features"]:
            for value in feature.values():
                assert value is not None

    return record


def ingest(reference_genome, hgnc_path, gencode_path, canonical_transcripts_path, dataset_id, location):
    source_file = prepare(reference_genome, hgnc_path, gencode_path, canonical_transcripts_path)

    client = bigquery.Client(location=location)
    dataset = client.create_dataset(dataset_id, exists_ok=True)
    table_id = f"{dataset.project}.{dataset.dataset_id}.gene_model"
    table_ref = bigquery.Table(table_id, schema=TABLE_SCHEMA)

    # Set Range parition and clustering on table
    max_global_bp = sum(CHROM_LENGTHS[reference_genome.lower()].values())
    partition_interval = int(max(math.ceil(max_global_bp / MAX_NUM_PARTITIONS), int(4e6)))
    table_ref.range_partitioning = bigquery.RangePartitioning(
        field="global_start",
        range_=bigquery.PartitionRange(start=0, end=max_global_bp, interval=partition_interval),
    )
    table_ref.clustering_fields = ["gene_id", "chrom"]

    # Delete first in case the schema has changed
    client.delete_table(table_id, not_found_ok=True)
    client.create_table(table_ref)

    job_config_kwargs = dict(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        autodetect=False,
        max_bad_records=0,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    job_config = bigquery.LoadJobConfig(**job_config_kwargs)
    with open(source_file, "rb") as handle:
        job = client.load_table_from_file(handle, destination=table_id, job_config=job_config)

    try:
        print(f"Starting job {job.job_id}")
        job.result()
        print("Job has finished")

        table = client.get_table(table_id)
        print(f"Loaded {table.num_rows} rows into '{table_id}'")
        return table
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")
