import json
import math
from urllib.parse import urlparse

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
    bigquery.SchemaField(
        "functional_annotation",
        "RECORD",
        mode="NULLABLE",
        fields=[
            bigquery.SchemaField(
                "list",
                "RECORD",
                mode="REPEATED",
                fields=[bigquery.SchemaField("item", "STRING", "REQUIRED")],
            )
        ],
    ),
    bigquery.SchemaField("round", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("cell_type_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("fdr", "FLOAT", mode="REQUIRED"),
]

VARIANT_TABLE_SCHEMA = [
    bigquery.SchemaField("chrom", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("global_bp", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("a1", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("a2", "STRING", mode="REQUIRED"),
]


def prepare(bucket_name, directory) -> list[str]:
    client = storage.Client()
    bucket = client.get_bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=directory.replace(f"{bucket.name}/", ""))

    def is_eqtl_file(name):
        return (name.endswith(".parquet")) and (("correlation_results_") in name or ("sig-snps-" in name))

    return [f"gs://{bucket.name}/{blob.name}" for blob in blobs if is_eqtl_file(blob.name)]


def ingest(input_dir, reference_genome, dataset_id, location):
    bucket = urlparse(input_dir if input_dir.startswith("gs://") else f"gs://{input_dir}").netloc
    directory = input_dir.replace("gs://", "")
    source_files = prepare(bucket_name=bucket, directory=directory)

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
