import json

import pyarrow.parquet as pq
from google.cloud import bigquery
from google.api_core import exceptions


def prepare(input_file):
    table = pq.read_table(input_file)
    columns = ["data" if c == "struct" else c for c in table.schema.names]
    table = table.rename_columns(columns)

    output = "/tmp/eqtl_effect.parquet"
    pq.write_table(table, output)

    print(f"Output saved to {output}")
    return output


def ingest(input_file, dataset_id, location) -> bigquery.Table:
    source_file = prepare(input_file)

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
