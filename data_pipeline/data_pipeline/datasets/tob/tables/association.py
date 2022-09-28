import json
import math

from google.cloud import bigquery, storage
from google.api_core import exceptions

from data_pipeline.datasets.tob.helpers import CHROM_LENGTHS, MAX_NUM_PARTITIONS


ASSOCIATION_TABLE_SCHEMA = [
    bigquery.SchemaField("gene_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("gene_symbol", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("spearmans_rho", "FLOAT", mode="REQUIRED"),
    bigquery.SchemaField("p_value", "FLOAT", mode="REQUIRED"),
    bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("global_bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("a1", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("a2", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("functional_annotation", "STRING"),
    bigquery.SchemaField("round", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("cell_type_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("fdr", "FLOAT", mode="REQUIRED"),
    bigquery.SchemaField("is_esnp", "BOOLEAN"),
]

VARIANT_TABLE_SCHEMA = [
    bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("global_bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("a1", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("a2", "STRING", mode="REQUIRED"),
]


def prepare(input_dir, bucket) -> list[str]:
    client = storage.Client()
    bucket = client.get_bucket(bucket)
    blobs = bucket.list_blobs(input_dir)

    return [f"gs://{bucket}/{blob.name}" for blob in blobs if blob.name.endswith(".parquet")]


def ingest(input_dir, bucket, reference_genome, dataset_id, location):
    source_files = prepare(input_dir=input_dir, bucket=bucket)

    client = bigquery.Client(location=location)
    dataset = client.create_dataset(dataset_id, exists_ok=True)

    association_table_id = f"{dataset.project}.{dataset.dataset_id}.association"
    association_table_ref = bigquery.Table(association_table_id, schema=ASSOCIATION_TABLE_SCHEMA)

    variant_table_id = f"{dataset.project}.{dataset.dataset_id}.variant"
    variant_table_ref = bigquery.Table(variant_table_id, schema=VARIANT_TABLE_SCHEMA)

    # Set Range parition and clustering on table
    max_global_bp = sum(CHROM_LENGTHS[reference_genome.lower()].values())
    partition_interval = int(max(math.ceil(max_global_bp / MAX_NUM_PARTITIONS), int(4e6)))

    association_table_ref.clustering_fields = ["gene_id", "cell_type_id", "round", "chrom"]
    association_table_ref.range_partitioning = bigquery.RangePartitioning(
        field="global_bp",
        range_=bigquery.PartitionRange(start=0, end=max_global_bp, interval=partition_interval),
    )

    variant_table_ref.clustering_fields = ["chrom"]
    variant_table_ref.range_partitioning = bigquery.RangePartitioning(
        field="global_bp",
        range_=bigquery.PartitionRange(start=0, end=max_global_bp, interval=partition_interval),
    )

    # Delete first in case the schema has changed
    client.delete_table(variant_table_id, not_found_ok=True)
    client.delete_table(association_table_id, not_found_ok=True)

    client.create_table(variant_table_ref)
    table = client.create_table(association_table_ref)

    job_config_kwargs = dict(
        source_format=bigquery.SourceFormat.PARQUET,
        autodetect=False,
        max_bad_records=0,
        schema=table.schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    job_config = bigquery.LoadJobConfig(**job_config_kwargs)
    job = client.load_table_from_uri(source_uris=source_files, destination=table, job_config=job_config)

    try:
        print(f"Starting job {job.job_id}")
        job.result()
        print("Job has finished")

        table = client.get_table(association_table_id)
        print(f"Loaded {table.num_rows} rows into '{association_table_id}'")
        return table
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")
