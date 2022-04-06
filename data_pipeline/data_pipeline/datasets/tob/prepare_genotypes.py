#!/usr/bin/env python3
# coding: utf-8

import re
from pathlib import Path
import shelve
from collections import OrderedDict
from functools import reduce

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

    files_to_process = [str(path) for path in blobs if re.search(r"Genotypes", str(path), flags=re.IGNORECASE)]
    chromosomes = sorted(
        set([Path(s).stem.split("_")[1] for s in files_to_process]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    for chrom in chromosomes:
        paths = [str(p) for p in files_to_process if re.search(rf"genotype_{chrom}\.tsv", str(p))]
        if not paths:
            print(f"Could not find a genotype file for '{chrom}'")
            continue

        print(f"Loading genotype file for '{chrom}' from '{paths[0]}'")
        table = load_file(
            paths[0], global_coordinate_lookup=global_coordinate_lookup, reference_genome=reference_genome, chunks=100
        )

        output_path = f"{output_dir}/genotypes/{chrom}.tsv.gz"
        print(f"Writing table to '{output_path}'")

        table.to_csv(output_path, mode="w", sep="\t", header=True, index=False, compression="gzip")


def load_file(path, global_coordinate_lookup=None, reference_genome=None, chunks=100):
    table = pd.read_table(path, header=0, sep="\t").rename(columns={"sampleid": "sample_id"})
    lookup = global_coordinate_lookup
    if isinstance(global_coordinate_lookup, str):
        lookup = shelve.open(global_coordinate_lookup)

    list_df = []
    for chunk in np.array_split(table, chunks):
        chunk = chunk.melt(
            id_vars=["sample_id"],
            var_name="snp_id",
            value_name="genotype",
        )
        chunk["chrom"] = chunk["snp_id"].apply(lambda s: s.split(":")[0])
        chunk["bp"] = chunk["snp_id"].apply(lambda s: int(s.split(":")[1].split("_")[0]))
        list_df.append(chunk)

        if reference_genome is not None:
            chunk = convert_to_global_bp(chunk, reference_genome=reference_genome)
        elif lookup is not None:
            chunk["global_bp"] = chunk["bp"].apply(lambda n: lookup.get(str(int(n)), -1))
        else:
            chunk["global_bp"] = -1

    table = pd.concat(list_df).reindex()
    column_order = ["sample_id", "snp_id", "chrom", "bp", "global_bp", "genotype"]
    return table[column_order]


def convert_to_global_bp(dataframe, reference_genome="GRCh37"):
    # Use dummy ref and alt bases
    table = hail.Table.from_pandas(dataframe)
    result = table.annotate(
        global_bp=hail.parse_variant(
            hail.str(table.snp_id).replace("_", ":") + ":A", reference_genome=reference_genome
        ).locus.global_position()
    )

    return result.to_pandas()


def read_matrix_table(path, bucket, row_key="sampleid"):
    relative_path = path.replace(f"gs://{bucket.name}/", "")
    blob = bucket.get_blob(relative_path)

    columns = []
    with blob.open("r") as handle:
        columns = handle.readline().split("\t")
    columns = [c.strip() for c in columns if c and c.strip()]

    row_fields = OrderedDict()
    for col in columns:
        row_fields[col] = hail.tstr if col == row_key else hail.tint

    return hail.import_matrix_table(path, row_fields=row_fields, row_key=row_key, delimiter="\t")


def merge_matrix_tables(mts, row_join_type="outer"):
    return reduce(lambda a, b: a.union_cols(b, row_join_type=row_join_type), mts[1:], mts[0])


if __name__ == "__main__":
    hail.init()

    prepare_genotypes()
