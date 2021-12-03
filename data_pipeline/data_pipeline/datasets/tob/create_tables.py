#!/usr/bin/env python3
# coding: utf-8

import math
import json

from google.cloud import storage, bigquery
from google.api_core import exceptions

from data_pipeline.config import pipeline_config
from data_pipeline.datasets.tob.helpers import PROJECT, get_gcp_bucket_name


def init_tables(delete_existing_tables=False, reference="grch37"):
    schemas = {
        "association": [
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("cell_type_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("cell_type_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("rsid", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("snpid", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("gene", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("ensembl_gene_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("bp", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("global_bp", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("a1", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("a2", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("a2_freq_onek1k", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("a2_freq_hrc", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("spearmans_rho", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("s_statistic", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("p_value", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("q_value", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("fdr", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("rsquare", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("genotyped", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("round", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("is_esnp", "BOOLEAN", mode="REQUIRED"),
        ],
        "log_residual": [
            bigquery.SchemaField("sample_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("cell_type_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("gene", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("residual", "FLOAT", mode="REQUIRED"),
        ],
        "cell_type": [
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("parent_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("description", "STRING", mode="REQUIRED"),
        ],
        "gene_model": [
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
        ],
    }

    # Largest chromosome (chr1) has ~250 Million base pairs
    chrom_lengths = {
        "grch37": {
            "chr1": 249250621,
            "chr2": 243199373,
            "chr3": 198022430,
            "chr4": 191154276,
            "chr5": 180915260,
            "chr6": 171115067,
            "chr7": 159138663,
            "chr8": 146364022,
            "chr9": 141213431,
            "chr10": 135534747,
            "chr11": 135006516,
            "chr12": 133851895,
            "chr13": 115169878,
            "chr14": 107349540,
            "chr15": 102531392,
            "chr16": 90354753,
            "chr17": 81195210,
            "chr18": 78077248,
            "chr19": 59128983,
            "chr20": 63025520,
            "chr21": 48129895,
            "chr22": 51304566,
            "chrX": 155270560,
            "chrY": 59373566,
        },
        "grch38": {
            "chr1": 248956422,
            "chr2": 242193529,
            "chr3": 198295559,
            "chr4": 190214555,
            "chr5": 181538259,
            "chr6": 170805979,
            "chr7": 159345973,
            "chr8": 145138636,
            "chr9": 138394717,
            "chr10": 133797422,
            "chr11": 135086622,
            "chr12": 133275309,
            "chr13": 114364328,
            "chr14": 107043718,
            "chr15": 101991189,
            "chr16": 90338345,
            "chr17": 83257441,
            "chr18": 80373285,
            "chr19": 58617616,
            "chr20": 64444167,
            "chr21": 46709983,
            "chr22": 50818468,
            "chrX": 156040895,
            "chrY": 57227415,
        },
    }

    bq_client = bigquery.Client()
    dataset = bq_client.dataset(reference)

    max_global_bp = sum(chrom_lengths[reference.lower()].values())
    max_num_partitions = 4000
    partition_interval = int(max(math.ceil(max_global_bp / max_num_partitions), int(4e6)))

    tables = {}
    for (table_name, schema) in schemas.items():
        table_id = f"{dataset.project}.{dataset.dataset_id}.{table_name}"
        table_ref = bigquery.Table(table_id, schema=schema)

        if table_name == "association":
            # Note: Google limits the number of cluster fields to 4
            table_ref.clustering_fields = ["gene", "cell_type_id", "round", "genotyped"]
            table_ref.range_partitioning = bigquery.RangePartitioning(
                field="global_bp",
                range_=bigquery.PartitionRange(start=0, end=max_global_bp, interval=partition_interval),
            )

        if table_name == "log_residual":
            table_ref.clustering_fields = ["chrom", "gene", "cell_type_id"]

        if table_name == "gene_model":
            table_ref.range_partitioning = bigquery.RangePartitioning(
                field="global_start",
                range_=bigquery.PartitionRange(start=0, end=max_global_bp, interval=partition_interval),
            )
            table_ref.clustering_fields = ["chrom", "symbol", "gene_id"]

        try:
            if delete_existing_tables:
                print(f"Deleting existing table '{table.table_id}'")
                bq_client.delete_table(table_ref, not_found_ok=True)

            table = bq_client.create_table(table_ref)
            print(f"Created table '{table.table_id}'")
        except exceptions.GoogleAPIError as error:
            print(error)
            table = bq_client.get_table(table_id)
            print(f"Retrieved existing table '{table.table_id}'")

        tables[table_name] = table

    return tables


def populate_table(
    table,
    source_uris,
    source_uri_format=bigquery.SourceFormat.CSV,
    delimiter="\t",
    reference="grch37",
    skip_leading_rows=1,
    max_bad_records=0,
    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
):
    client = bigquery.Client()
    dataset = client.dataset(reference.lower())

    job_config_kwargs = dict(
        source_format=source_uri_format,
        autodetect=False,
        schema=table.schema,
        max_bad_records=max_bad_records,
        write_disposition=write_disposition,
    )

    if source_uri_format == bigquery.SourceFormat.CSV:
        job_config_kwargs = dict(skip_leading_rows=skip_leading_rows, field_delimiter=delimiter, **job_config_kwargs)

    job_config = bigquery.LoadJobConfig(**job_config_kwargs)
    load_job = client.load_table_from_uri(source_uris=source_uris, destination=table, job_config=job_config)

    try:
        print(f"Starting job {load_job.job_id}")
        load_job.result()
        print("Job has finished")

        table = client.get_table(dataset.table(table.table_id))
        print(f"Loaded {table.num_rows} rows into '{table.table_id}'")

        return table
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")


def create_tables(delete_existing_tables=True):
    client = storage.Client()
    bucket = client.get_bucket(get_gcp_bucket_name())
    reference = pipeline_config.get(PROJECT, "reference").lower()

    tables = init_tables(delete_existing_tables=delete_existing_tables, reference=reference)
    blobs = list(bucket.list_blobs())

    association_table = tables["association"]
    print("Populating association table")
    populate_table(
        table=association_table,
        reference=reference,
        source_uris=[
            f"gs://{bucket.name}/{blob.name}"
            for blob in blobs
            if "/associations/" in blob.name and blob.name.endswith(".tsv.gz")
        ],
        delimiter="\t",
        source_uri_format=bigquery.SourceFormat.CSV,
    )

    log_residual_table = tables["log_residual"]
    print("Populating log residual table")
    populate_table(
        table=log_residual_table,
        reference=reference,
        source_uris=[
            f"gs://{bucket.name}/{blob.name}"
            for blob in blobs
            if "/log_residuals/" in blob.name and blob.name.endswith(".tsv.gz")
        ],
        delimiter="\t",
        source_uri_format=bigquery.SourceFormat.CSV,
    )

    gene_model_table = tables["gene_model"]
    print("Populating gene model table")
    populate_table(
        table=gene_model_table,
        reference=reference,
        source_uris=[
            f"gs://{bucket.name}/{blob.name}" for blob in blobs if "/metadata/gene_models.ndjson.gz" in blob.name
        ],
        max_bad_records=0,
        source_uri_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    )

    cell_types_table = tables["cell_type"]
    print("Populating cell type table")
    populate_table(
        table=cell_types_table,
        reference=reference,
        source_uris=[f"gs://{bucket.name}/{blob.name}" for blob in blobs if "/metadata/cell_types.tsv" in blob.name],
        delimiter="\t",
        source_uri_format=bigquery.SourceFormat.CSV,
    )


if __name__ == "__main__":
    create_tables()
