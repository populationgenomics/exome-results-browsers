#!/usr/bin/env python3
# coding: utf-8

import json
import re
from pathlib import Path
from collections import OrderedDict
from functools import reduce

import hail
import pandas as pd
from google.cloud import storage

from data_pipeline.datasets.tob.helpers import (
    chrom_ord,
    get_gcp_bucket_name,
    build_output_path,
    build_analaysis_input_path,
)


def prepare_expression(symbol_mapping=None):
    client = storage.Client()
    bucket = client.get_bucket(get_gcp_bucket_name())

    input_path = build_analaysis_input_path()
    output_dir = build_output_path()

    blobs = [
        f"gs://{bucket.name}/{b.name}"
        for b in bucket.list_blobs()
        if re.search(f"{input_path.replace(f'gs://{bucket.name}/', '')}/Residuals/", str(b.name))
    ]

    # Create lookup table to update set gene identifier column from gene symbols column
    if symbol_mapping is None:
        mapping_file = f"{output_dir}/metadata/gene_symbol_to_id.json".replace(f"gs://{bucket.name}/", "")
        print(f"Look for gene symbol map at location '{mapping_file}'")

        blob = bucket.get_blob(mapping_file)
        symbol_mapping = json.loads(blob.download_as_string()) if blob else None

        if symbol_mapping:
            print("Loading from existing mapping file")
        else:
            print("Mapping file not found. Gene symbols will not be mapped to Ensembl ids")

    # TODO: Update this regex once new expression files are ready #pylint: disable=fixme
    files_to_process = [str(path) for path in blobs if re.search(r"Residuals", str(path))]

    chromosomes = sorted(
        set([Path(s).stem.split("_")[1] for s in files_to_process]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    for chrom in chromosomes:
        paths = [str(p) for p in files_to_process if f"_{chrom}_" in str(p)]

        print(f"Loading {len(paths)} files for {chrom}")
        residuals = pd.concat([load_file(path, symbol_mapping) for path in paths])

        output_path = f"{output_dir}/expression/{chrom}.tsv.gz"
        print(f"Writing table to '{output_path}'")

        residuals.to_csv(output_path, mode="w", sep="\t", header=True, index=False, compression="gzip")


def load_file(path, symbol_to_id=None):
    table = (
        pd.read_table(path, header=0, sep="\t")
        .rename(columns={"sampleid": "sample_id"})
        .melt(
            id_vars=["sample_id"],
            var_name="gene_symbol",
            value_name="log_cpm",
        )
    )

    cell_type = Path(path).stem.split("_")[0]
    chrom = Path(path).stem.split("_")[1].replace("chr", "")

    table["cell_type_id"] = cell_type
    table["chrom"] = chrom
    table["gene_id"] = table["gene_symbol"].apply(lambda x: (symbol_to_id or {}).get(x, None))

    column_order = ["sample_id", "cell_type_id", "gene_id", "gene_symbol", "chrom", "log_cpm"]

    return table[column_order]


def read_matrix_table(path, bucket, row_key="sampleid"):
    relative_path = path.replace(f"gs://{bucket.name}/", "")
    blob = bucket.get_blob(relative_path)

    columns = []
    with blob.open("r") as handle:
        columns = handle.readline().split("\t")
    columns = [c.strip() for c in columns if c and c.strip()]

    row_fields = OrderedDict()
    for col in columns:
        row_fields[col] = hail.tstr if col == row_key else hail.tfloat

    return hail.import_matrix_table(path, row_fields=row_fields, row_key=row_key, delimiter="\t")


def merge_matrix_tables(mts, row_join_type="outer"):
    return reduce(lambda a, b: a.union_cols(b, row_join_type=row_join_type), mts[1:], mts[0])


if __name__ == "__main__":
    prepare_expression()
