import json

from google.cloud import bigquery
from google.api_core import exceptions

# NOTE: Add SQL query to add search indices to improve lookup performance. Only available in US and EU locations
#       as of Sep-2022

def normalize_data(project_id, dataset_id, location):
    """
    Run this first before other post processing steps since it will affect joins
    """
    queries = []
    queries.append(
        f"""
    UPDATE {project_id}.{dataset_id}.associations
    SET cell_type_id = LOWER(cell_type_id), gene_id = SUBSTRING_INDEX(gene_id, '.', 1)
    WHERE 1=1
    """
    )

    queries.append(
        f"""
    UPDATE {project_id}.{dataset_id}.cell_type
    SET cell_type_id = LOWER(cell_type_id)
    WHERE 1=1
    """
    )

    queries.append(
        f"""
    UPDATE {project_id}.{dataset_id}.expression
    SET cell_type_id = LOWER(cell_type_id), gene_id = SPLIT(gene_id, '.')[OFFSET(0)]
    WHERE 1=1
    """
    )

    queries.append(
        f"""
    UPDATE {project_id}.{dataset_id}.eqtl_effect
    SET cell_type_id = LOWER(cell_type_id), gene_id = SPLIT(gene_id, '.')[OFFSET(0)]
    WHERE 1=1
    """
    )

    client = bigquery.Client(project=project_id, location=location)
    job_config = bigquery.QueryJobConfig(use_legacy_sql=False)

    for query in queries:
        try:
            client.query(query, job_config=job_config).result()
        except exceptions.BadRequest as error:
            print(f"Bad request: {error}")
            print(json.dumps(error.errors, indent=2))
        except exceptions.GoogleAPIError as error:
            print(f"Error: {error}")


def create_gene_lookup_table(project_id, dataset_id, location):
    sql_query = f"""
    CREATE OR REPLACE TABLE
        `{project_id}.{dataset_id}.gene_lookup` (
            gene_id STRING NOT NULL, 
            gene_symbol STRING NOT NULL
        )
    AS (
        SELECT
            DISTINCT X.gene_id,
            X.symbol gene_symbol
        FROM
            `{project_id}.{dataset_id}.gene_model` AS X
        INNER JOIN
            `{project_id}.{dataset_id}.association` AS Y
            ON X.gene_id = Y.gene_id
        ORDER BY 
            X.gene_id ASC
    )
    """

    client = bigquery.Client(project=project_id, location=location)
    job_config = bigquery.QueryJobConfig(use_legacy_sql=False)

    try:
        return client.query(sql_query, job_config=job_config).result()
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")


def remove_genes_not_in_analysis(project_id, dataset_id, location):
    """
    Deletes rows from the `gene_model` table which are not in the `gene_lookup` table. The `gene_lookup` table
    contains all unique (gene_id, gene_symbol) pairs which are in the `association` table.
    """
    sql_query = f"""
    DELETE FROM `{project_id}.{dataset_id}.gene_model`
    WHERE gene_id NOT IN (
        SELECT gene_id
        FROM `{project_id}.{dataset_id}.gene_lookup`
    )
    """

    client = bigquery.Client(project=project_id, location=location)
    job_config = bigquery.QueryJobConfig(use_legacy_sql=False)

    try:
        return client.query(sql_query, job_config=job_config).result()
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")


def insert_into_variant_table(project_id, dataset_id, location):
    sql_query = f"""
    INSERT INTO `{project_id}.{dataset_id}.variant` (chrom, bp, global_bp, a1, a2)
    SELECT DISTINCT chrom, bp, global_bp, a1, a2
    FROM `{project_id}.{dataset_id}.association`
    """

    client = bigquery.Client(project=project_id, location=location)
    job_config = bigquery.QueryJobConfig(use_legacy_sql=False)

    try:
        return client.query(sql_query, job_config=job_config).result()
    except exceptions.BadRequest as error:
        print(f"Bad request: {error}")
        print(json.dumps(error.errors, indent=2))
    except exceptions.GoogleAPIError as error:
        print(f"Error: {error}")
