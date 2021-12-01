#!/usr/bin/env python
# coding: utf-8

import re

import hail
from google.cloud import storage

from data_pipeline.config import pipeline_config
from data_pipeline.datasets.tob.helpers import (
    PROJECT,
    chrom_ord,
    get_gcp_bucket_name,
    build_analaysis_input_path,
    build_output_path,
)


def import_table(paths, schema=None):
    return hail.import_table(paths, types=schema, impute=not schema)


def process_table(table, reference="grch37", is_esnp=False):
    result = table.transmute(BP=hail.int32(table.BP), CHROM=table.CHR)

    result = result.annotate(
        variant=hail.parse_variant(
            hail.str(":").join([hail.str(result.CHROM), hail.str(result.BP), result.A1, result.A2]),
            reference_genome=reference,
        )
    )

    result = result.annotate(
        is_esnp=hail.bool(is_esnp),
        global_bp=result.variant.locus.global_position(),
        id=hail.str(":").join(
            [
                hail.str(result.CHROM),
                hail.str(result.BP),
                result.A1,
                result.A2,
                result.GENE,
                result.db_key,
                hail.str(result.ROUND),
            ]
        ),
    )

    result = result.rename({"db_key": "cell_type_id"})
    result = result.rename({c: c.lower() for c in list(result.row.keys())})

    columns = [c for c in list(result.row.keys()) if c not in ("id", "global_bp")]
    result = result.select(["id"] + columns[0:8] + ["global_bp"] + columns[8:])

    return result.drop(result.variant).key_by("id")


def prepare_associations():
    client = storage.Client()
    input_path = build_analaysis_input_path()
    output_path = build_output_path()

    bucket = client.get_bucket(get_gcp_bucket_name())
    blobs = [
        f"gs://{bucket.name}/{b.name}"
        for b in bucket.list_blobs()
        if (input_path.split(f"gs://{bucket.name}/")[-1] in b.name) and (".tsv" in b.name)
    ]

    eqtls = [str(path) for path in blobs if re.search(r"eSNP", str(path))]
    esnps = [str(path) for path in blobs if re.search(r"eQTL", str(path))]

    schema = {
        "db_key": hail.tstr,
        "cell_type": hail.tstr,
        "RSID": hail.tstr,
        "SNPID": hail.tstr,
        "GENE": hail.tstr,
        "ENSEMBL_GENE_ID": hail.tstr,
        "CHR": hail.tstr,
        "BP": hail.tfloat64,
        "A1": hail.tstr,
        "A2": hail.tstr,
        "A2_FREQ_ONEK1K": hail.tfloat64,
        "A2_FREQ_HRC": hail.tfloat64,
        "SPEARMANS_RHO": hail.tfloat64,
        "S_STATISTICS": hail.tfloat64,
        "P_VALUE": hail.tfloat64,
        "Q_VALUE": hail.tfloat64,
        "FDR": hail.tfloat64,
        "RSQUARE": hail.tfloat64,
        "GENOTYPED": hail.tstr,
        "ROUND": hail.tint32,
    }

    chromosomes = sorted(
        set([re.search(r"_(?P<chrom>chr\d+)_", str(s), flags=re.IGNORECASE).group("chrom") for s in [*eqtls, *esnps]]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    reference = pipeline_config.get(PROJECT, "reference").lower()

    for (index, chrom) in enumerate(chromosomes):
        output_path = f"{output_path}/associations/{chrom}.tsv.gz"

        print(f"Loading association files for {chrom}")
        eqtl_table = process_table(
            table=import_table(paths=[str(p) for p in eqtls if f"_{chrom}_" in str(p)], schema=schema),
            reference=reference,
            is_esnp=False,
        )
        esnp_table = process_table(
            table=import_table(paths=[str(p) for p in esnps if f"_{chrom}_" in str(p)], schema=schema),
            reference=reference,
            is_esnp=True,
        )

        association_table = eqtl_table.join(esnp_table)

        print(f"Writing output to '{output_path}'")
        association_table.export(
            output=output_path,
            types_file=output_path.replace(f"{chrom}.tsv.gz", "types.txt") if index == 0 else None,
            delimiter="\t",
            header=True,
        )


if __name__ == "__main__":
    prepare_associations()
