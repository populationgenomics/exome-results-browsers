import json

import pandas as pd
from google.cloud import bigquery
from google.api_core import exceptions


TABLE_SCHEMA = [
    bigquery.SchemaField("cell_type_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("cell_type_name", "STRING"),
    bigquery.SchemaField("description", "STRING"),
]


def prepare(input_file) -> str:
    table = pd.read_table(input_file, header="infer", sep="," if ".csv" in input_file else "\t")
    columns = set(table.columns.tolist())

    if "cell_type" in columns and "cell_type_id" not in columns:
        table = table.rename(columns={"cell_type": "cell_type_id"})  # pylint: disable=no-member

    if "cell_type_name" not in columns:
        table = table.assign(cell_type_name=None)

    if "description" not in columns:
        table = table.assign(description=None)

    output = "/tmp/cell_types.tsv"
    table.to_csv(output, mode="w", sep="\t", header=True, index=False)

    print(f"Output saved to {output}")
    return output


def ingest(input_file, dataset_id, location) -> bigquery.Table | None:
    source_file = prepare(input_file)

    client = bigquery.Client(location=location)
    dataset = client.create_dataset(dataset_id, exists_ok=True)
    table_id = f"{dataset.project}.{dataset.dataset_id}.cell_type"
    table_ref = bigquery.Table(table_id, schema=TABLE_SCHEMA)

    # Delete first in case the schema has changed
    client.delete_table(table_id, not_found_ok=True)
    client.create_table(table_ref)

    job_config_kwargs = dict(
        source_format=bigquery.SourceFormat.CSV,
        autodetect=False,
        max_bad_records=0,
        skip_leading_rows=1,
        field_delimiter="\t",
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
