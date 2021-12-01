#!/usr/bin/env python3
# coding: utf-8

import re
from pathlib import Path

import pandas as pd
from google.cloud import storage

from data_pipeline.datasets.tob.helpers import (
    chrom_ord,
    get_gcp_bucket_name,
    build_output_path,
    build_analaysis_input_path,
)


def load_residual_file(path):
    residuals = pd.read_table(path, header=0, sep="\t").melt(
        id_vars=["sampleid"],
        var_name="gene",
        value_name="log_residual",
    )

    cell_type = Path(path).stem.split("_")[0]
    chrom = Path(path).stem.split("_")[1].replace("chr", "")

    residuals["cell_type_id"] = cell_type
    residuals["chrom"] = chrom

    column_order = ["sampleid", "cell_type_id", "chrom", "gene", "log_residual"]

    return residuals[column_order].rename(columns={"sampleid": "sample_id"})


def prepare_log_residuals():
    client = storage.Client()
    bucket = client.get_bucket(get_gcp_bucket_name())

    input_path = build_analaysis_input_path()
    output_dir = build_output_path()

    blobs = [
        f"gs://{bucket.name}/{b.name}"
        for b in bucket.list_blobs()
        if (input_path.split(f"gs://{bucket.name}/")[-1] in b.name) and (".tsv" in b.name)
    ]

    files_to_process = [str(path) for path in blobs if re.search(r"Residuals", str(path))]

    chromosomes = sorted(
        set([Path(s).stem.split("_")[1] for s in files_to_process]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    for chrom in chromosomes:
        paths = [str(p) for p in files_to_process if f"_{chrom}_" in str(p)]

        print(f"Loading {len(paths)} files for {chrom}")
        residuals = pd.concat([load_residual_file(path) for path in paths])

        output_path = f"{output_dir}/log_residuals/{chrom}.tsv.gz"
        print(f"Writing table to '{output_path}'")

        residuals.to_csv(output_path, mode="w", sep="\t", header=True, index=False, compression="gzip")


if __name__ == "__main__":
    prepare_log_residuals()
