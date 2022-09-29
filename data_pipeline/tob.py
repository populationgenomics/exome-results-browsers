#!/usr/bin/env python3
# coding: utf-8

# pylint: disable=fixme
# TODO: Add args and logic for running this job on a dataproc

import click

from data_pipeline.datasets.tob import tables, post_process


@click.group()
@click.option(
    "--project-id",
    default="tob-wgs-browser",
    help="Specify your GCP project identifier.",
    type=str,
)
@click.option(
    "--dataset-id",
    default="grch38",
    help="Specify a BigQuery dataset identifier to use (this will be created if it doesn't exist).",
    type=str,
)
@click.option(
    "--location",
    default="australia-southeast1",
    help="Specify a BigQuery geographical location to use (the region to use to create a new dataset if required).",
    type=str,
)
@click.option(
    "--reference",
    default="GRCh38",
    type=click.Choice(["GRCh37", "GRCh38"], case_sensitive=True),
    help="Reference genome identifier.",
)
@click.pass_context
def cli(ctx, project_id, dataset_id, location, reference):
    ctx.ensure_object(dict)

    ctx.obj["project_id"] = project_id
    ctx.obj["dataset_id"] = dataset_id
    ctx.obj["location"] = location
    ctx.obj["reference"] = reference.replace("grc", "GRC")

    return ctx


# ----- Cell types table ----- #
@cli.command("cell-type", help="This command formats and ingests the cell type information table.")
@click.option(
    "--input-file",
    help="Path to cell types metadata file.",
    type=str,
    required=True,
)
@click.pass_context
def cell_type(ctx, input_file):
    tables.cell_type.ingest(input_file, dataset_id=ctx.obj["dataset_id"], location=ctx.obj["location"])


# ----- Expression aggregate table ----- #
@cli.command("expression", help="This command formats and ingests the gene expression aggregate data.")
@click.option(
    "--input-file",
    help="Path to gene expression aggregate parquet file.",
    type=str,
    required=True,
)
@click.pass_context
def expression(ctx, input_file):
    tables.expression.ingest(input_file, dataset_id=ctx.obj["dataset_id"], location=ctx.obj["location"])


# ----- eQTL gene expression effect aggregate table ----- #
@cli.command("eqtl-effect", help="This command formats and ingests the eQTL gene expression effect aggregate data.")
@click.option(
    "--input-dir",
    help="Full path containing eQTL effect aggregate files including the URI scheme and bucket name.",
    type=str,
    required=True,
)
@click.pass_context
def eqtl_effect(ctx, input_dir):
    tables.eqtl_effect.ingest(input_dir, dataset_id=ctx.obj["dataset_id"], location=ctx.obj["location"])


# ----- Gene model table ----- #
@cli.command("gene-model", help="This command creates the gene model table using HGNC, Gencode and NCBI gene data.")
@click.option(
    "--hgnc-path",
    help="Path to HGNC file.",
    type=str,
    required=True,
)
@click.option(
    "--gencode-path",
    help="Path to Gencode annotations (GTF) file. This should be the same version as used in the analysis pipeline.",
    type=str,
    required=True,
)
@click.option(
    "--canonical-transcripts-path",
    help="Path NCBI cannonical transcripts file.",
    type=str,
    required=True,
)
@click.pass_context
def gene_model(ctx, hgnc_path, gencode_path, canonical_transcripts_path):
    tables.gene_model.ingest(
        hgnc_path=hgnc_path,
        gencode_path=gencode_path,
        canonical_transcripts_path=canonical_transcripts_path,
        reference_genome=ctx.obj["reference"],
        dataset_id=ctx.obj["dataset_id"],
        location=ctx.obj["location"],
    )


# ----- eQTL associations ----- #
@cli.command(
    "eqtl-association",
    help="This command will ingest the output files from the analysis pipeline containing eQTL associations.",
)
@click.option(
    "--input-dir",
    help="Full path containing eQTL association files including the URI scheme and bucket name.",
    type=str,
    required=True,
)
@click.pass_context
def ingest_eqtl_associations(ctx, input_dir):
    dataset_id = ctx.obj["dataset_id"]
    location = ctx.obj["location"]
    reference = ctx.obj["reference"]

    tables.association.ingest(
        input_dir=input_dir,
        reference_genome=reference,
        dataset_id=dataset_id,
        location=location,
    )


# ----- Post processing ----- #
@cli.command("post-process", help="This command formats table data and creates additional lookup tables.")
@click.pass_context
def post(ctx):
    kwargs = dict(project_id=ctx.obj["project_id"], dataset_id=ctx.obj["dataset_id"], location=ctx.obj["location"])

    post_process.normalize_data(**kwargs)
    post_process.insert_into_variant_table(**kwargs)
    post_process.create_gene_lookup_table(**kwargs)
    post_process.remove_genes_not_in_analysis(**kwargs)


if __name__ == "__main__":
    cli()  # pylint: disable=no-value-for-parameter
