#!/usr/bin/env python3
# coding: utf-8

import re
from pathlib import Path
import shelve

import hail
import pandas as pd
import numpy as np
from google.cloud import storage

from data_pipeline.datasets.tob.helpers import (
    chrom_ord,
    get_gcp_bucket_name,
    build_output_path,
    build_analaysis_input_path,
)


def convert_to_global_bp(dataframe, reference_genome="GRCh37"):
    # Use dummy ref and alt bases
    table = hail.Table.from_pandas(dataframe)
    result = table.annotate(
        global_bp=hail.parse_variant(
            hail.str(table.snp_id).replace("_", ":") + ":A", reference_genome=reference_genome
        ).locus.global_position()
    )

    return result.to_pandas()


def load_file(path, global_coordinate_lookup=None, reference_genome=None):
    table = (
        pd.read_table(path, header=0, sep="\t")
        .rename(columns={"sampleid": "sample_id"})
        .melt(
            id_vars=["sample_id"],
            var_name="snp_id",
            value_name="genotype",
        )
    )

    table["chrom"] = table["snp_id"].apply(lambda s: s.split(":")[0])
    table["bp"] = table["snp_id"].apply(lambda s: int(s.split(":")[1].split("_")[0]))

    if reference_genome is not None:
        print(f"Converting to global coordinates using reference '{reference_genome}'")
        # Hail frequently into an OutOfMemoryError, so temp solution is to convert in chunks
        list_df = []
        for chunk in np.array_split(table, 100):
            list_df.append(convert_to_global_bp(chunk, reference_genome=reference_genome))

        table = pd.concat(list_df).reindex()
    elif global_coordinate_lookup is not None:
        lookup = global_coordinate_lookup
        if isinstance(global_coordinate_lookup, str):
            lookup = shelve.open(global_coordinate_lookup)
        table["globfal_bp"] = table["bp"].apply(lambda n: lookup[n])
    else:
        table["global_bp"] = None

    column_order = ["sample_id", "snp_id", "chrom", "bp", "global_bp", "genotype"]
    return table[column_order]


def prepare_genotypes(global_coordinate_lookup=None, reference_genome=None):
    client = storage.Client()
    bucket = client.get_bucket(get_gcp_bucket_name())

    input_path = build_analaysis_input_path()
    output_dir = build_output_path()

    blobs = [
        f"gs://{bucket.name}/{b.name}"
        for b in bucket.list_blobs()
        if (input_path.split(f"gs://{bucket.name}/")[-1] in b.name) and (".tsv" in b.name)
    ]

    files_to_process = [str(path) for path in blobs if re.search(r"genotypes", str(path), flags=re.IGNORECASE)]

    chromosomes = sorted(
        set([Path(s).stem.split("_")[1] for s in files_to_process]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    for chrom in chromosomes:
        paths = [str(p) for p in files_to_process if f"_{chrom}_" in str(p)]

        print(f"Loading {len(paths)} files for {chrom}")
        residuals = pd.concat(
            [
                load_file(path, global_coordinate_lookup=global_coordinate_lookup, reference_genome=reference_genome)
                for path in paths
            ]
        )

        output_path = f"{output_dir}/genotypes/{chrom}.tsv.gz"
        print(f"Writing table to '{output_path}'")

        residuals.to_csv(output_path, mode="w", sep="\t", header=True, index=False, compression="gzip")


if __name__ == "__main__":
    hail.init()

    prepare_genotypes()
