import json
from urllib.parse import urlparse

from google.cloud import bigquery, storage
from google.api_core import exceptions


def prepare(bucket_name, directory) -> list[str]:
    client = storage.Client()
    bucket = client.get_bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=directory.replace(f"{bucket.name}/", ""))

    def is_effect_file(name):
        return (name.endswith(".parquet")) and (("eqtl_effect_") in name)

    return [f"gs://{bucket.name}/{blob.name}" for blob in blobs if is_effect_file(blob.name)]


def ingest(input_dir, dataset_id, location) -> bigquery.Table:
    bucket = urlparse(input_dir if input_dir.startswith("gs://") else f"gs://{input_dir}").netloc
    directory = input_dir.replace("gs://", "")
    source_files = prepare(bucket_name=bucket, directory=directory)

    client = bigquery.Client(location=location)
    dataset = client.create_dataset(dataset_id, exists_ok=True)
    table_id = f"{dataset.project}.{dataset.dataset_id}.eqtl_effect"

    # Delete first in case the schema has changed
    client.delete_table(table_id, not_found_ok=True)

    job_config_kwargs = dict(
        source_format=bigquery.SourceFormat.PARQUET,
        autodetect=True,
        max_bad_records=0,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    job_config = bigquery.LoadJobConfig(**job_config_kwargs)
    job = client.load_table_from_uri(source_uris=source_files, destination=table_id, job_config=job_config)

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
