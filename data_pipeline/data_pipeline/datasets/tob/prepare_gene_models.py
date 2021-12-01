#!/usr/bin/env python3
# coding: utf-8

import json
import csv

import hail as hl

from data_pipeline.config import pipeline_config
from data_pipeline.datasets.tob.helpers import (
    PROJECT,
    build_output_path,
    build_gencode_path,
    build_hgnc_path,
    build_canonical_transcripts_path,
)


def get_exons(gencode, reference_genome):
    """
    Filter Gencode table to exons and format fields.
    """
    exons = gencode.filter(hl.set(["exon", "CDS", "UTR", "start_codon", "stop_codon"]).contains(gencode.feature))
    exons = exons.select(
        feature_type=exons.feature,
        transcript_id=exons.transcript_id.split("\\.")[0],
        gene_id=exons.gene_id.split("\\.")[0],
        chrom=exons.interval.start.contig.replace("^chr", ""),
        strand=exons.strand,
        start=exons.interval.start.position,
        stop=exons.interval.end.position,
        global_start=hl.locus(
            exons.interval.start.contig.replace("^chr", ""),
            exons.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            exons.interval.end.contig.replace("^chr", ""),
            exons.interval.end.position,
            reference_genome,
        ).global_position(),
    )

    return exons


def get_genes(gencode, reference_genome):
    """
    Filter Gencode table to genes and format fields.
    """
    genes = gencode.filter(gencode.feature == "gene")
    genes = genes.select(
        gene_id=genes.gene_id.split("\\.")[0],
        gene_symbol=genes.gene_name,
        chrom=genes.interval.start.contig.replace("^chr", ""),
        strand=genes.strand,
        start=genes.interval.start.position,
        stop=genes.interval.end.position,
        global_start=hl.locus(
            genes.interval.start.contig.replace("^chr", ""),
            genes.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            genes.interval.end.contig.replace("^chr", ""),
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
        chrom=transcripts.interval.start.contig.replace("^chr", ""),
        strand=transcripts.strand,
        start=transcripts.interval.start.position,
        stop=transcripts.interval.end.position,
        global_start=hl.locus(
            transcripts.interval.start.contig.replace("^chr", ""),
            transcripts.interval.start.position,
            reference_genome,
        ).global_position(),
        global_stop=hl.locus(
            transcripts.interval.end.contig.replace("^chr", ""),
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

    # Extract genes, transcripts, and exons from the GTF file
    genes = get_genes(gencode, reference_genome)
    transcripts = get_transcripts(gencode, reference_genome)
    exons = get_exons(gencode, reference_genome)
    exons = exons.cache()

    # Annotate transcripts with their exons
    transcript_exons = exons.group_by(exons.transcript_id).aggregate(exons=hl.agg.collect(exons.row_value))

    transcripts = transcripts.annotate(
        exons=transcript_exons[transcripts.transcript_id].exons.map(
            lambda exon: exon.select("feature_type", "start", "stop", "global_start", "global_stop")
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
    canonical_transcripts = hl.import_table(canonical_transcripts_path, force=True, no_header=True, min_partitions=100)
    canonical_transcripts = canonical_transcripts.rename({"f0": "gene_id", "f1": "transcript_id"})
    canonical_transcripts = canonical_transcripts.key_by("gene_id")
    return canonical_transcripts


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


def prepare_gene_models_helper(reference_genome):
    gencode_path = build_gencode_path()
    canonical_transcripts_path = build_canonical_transcripts_path()

    # Load genes from GTF file
    genes = load_gencode_gene_models(gencode_path, reference_genome)
    genes = genes.distinct()
    genes = genes.transmute(gencode_gene_symbol=genes.gene_symbol)

    # Annotate genes with canonical transcript
    canonical_transcripts = load_canonical_transcripts(canonical_transcripts_path)
    genes = genes.annotate(canonical_transcript_id=canonical_transcripts[genes.gene_id].transcript_id)

    # Drop transcripts except for canonical
    genes = genes.annotate(
        canonical_transcript=genes.transcripts.filter(
            lambda transcript: transcript.transcript_id == genes.canonical_transcript_id
        ).head()
    )

    # genes = genes.annotate(
    #     canonical_transcript=genes.canonical_transcript.annotate(
    #         exons=hl.cond(
    #             genes.canonical_transcript.exons.any(lambda exon: exon.feature_type == "CDS"),
    #             genes.canonical_transcript.exons.filter(lambda exon: exon.feature_type == "CDS"),
    #             genes.canonical_transcript.exons.filter(lambda exon: exon.feature_type == "exon"),
    #         )
    #     )
    # )

    genes = genes.drop("transcripts")

    return genes


def prepare_gene_models():
    reference = pipeline_config.get(PROJECT, "reference")
    genes = prepare_gene_models_helper(reference)

    # Annotate genes with information from HGNC
    hgnc_path = build_hgnc_path()
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

    genes = genes.transmute(
        alias_symbols=hl.str("|").join(hl.or_else(genes.alias_symbols, hl.empty_array(hl.tstr))),
        previous_symbols=hl.str("|").join(hl.or_else(genes.previous_symbols, hl.empty_array(hl.tstr))),
    )

    dataframe = genes.to_pandas(flatten=False)
    dataframe.canonical_transcript = dataframe.canonical_transcript.apply(jsonize_pyspark_row)

    out_dir = build_output_path()
    output_path = f"{out_dir}/metadata/gene_models.tsv.gz"
    dataframe.to_csv(
        output_path, mode="w", sep="\t", header=True, index=False, quoting=csv.QUOTE_NONE, compression="gzip"
    )


def jsonize_pyspark_row(record):
    if record["transcript_id"] is None and record["exons"] is None:
        return None

    record = record.asDict()
    for value in record.values():
        assert value is not None

    if record["exons"] is not None:
        record["exons"] = [r.asDict() for r in record["exons"]]

        for exon in record["exons"]:
            for value in exon.values():
                assert value is not None

    return json.dumps(record)


if __name__ == "__main__":
    hl.init()

    prepare_gene_models()
