#!/usr/bin/env python3
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


def process_table(table, reference="grch37", is_esnp=False, verify=True):
    result = table.transmute(BP=hail.int32(table.BP))

    result = result.annotate(
        variant=hail.parse_variant(
            hail.str(":").join([hail.str(result.CHR), hail.str(result.BP), result.A1, result.A2]),
            reference_genome=reference,
        )
    )

    result = result.annotate(
        is_esnp=hail.bool(is_esnp),
        global_bp=result.variant.locus.global_position(),
        id=hail.str(":").join(
            [
                hail.str(result.CHR),
                hail.str(result.BP),
                result.A1,
                result.A2,
                result.GENE,
                result.db_key,
                hail.str(result.ROUND),
            ]
        ),
    )

    if verify:
        print("Verifying ID uniqueness")
        assert result.count() == result.key_by("id").distinct().count(), "id column contains duplicate values"

    result = result.rename({"db_key": "cell_type_id"})
    result = result.rename({"cell_type": "cell_type_name"})
    result = result.rename({"CHR": "chrom"})
    result = result.rename({c: c.lower() for c in list(result.row.keys())})

    columns = [c for c in list(result.row.keys()) if c not in ("id", "global_bp")]
    column_order = ["id"] + columns[0:8] + ["global_bp"] + columns[8:]
    result = result.select(*column_order)
    assert len(set(column_order)) == len(set(result.row.keys()))

    result = result.drop(result.variant)

    return result.order_by("global_bp").key_by("id").distinct()


def prepare_associations(verify=True):
    client = storage.Client()
    input_path = build_analaysis_input_path()
    output_dir = build_output_path()

    bucket = client.get_bucket(get_gcp_bucket_name())
    blobs = [
        f"gs://{bucket.name}/{b.name}"
        for b in bucket.list_blobs()
        if (input_path.split(f"gs://{bucket.name}/")[-1] in b.name) and (".tsv" in b.name)
    ]

    eqtls = [str(path) for path in blobs if re.search(r"eQTL", str(path))]
    esnps = [str(path) for path in blobs if re.search(r"eSNP", str(path))]

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

    matches = [re.search(r"_(?P<chrom>chr\d+)_", str(s), flags=re.IGNORECASE) for s in [*eqtls, *esnps]]
    chromosomes = sorted(
        set([m.group("chrom") for m in matches if m]),
        key=lambda chrom: chrom_ord(chrom.replace("chr", "")),
    )

    reference = pipeline_config.get(PROJECT, "reference")

    print("Loading eSNP files")
    esnp_table = process_table(
        table=import_table(paths=esnps, schema=schema),
        reference=reference,
        is_esnp=True,
        verify=verify,
    ).cache()

    for (index, chrom) in enumerate(chromosomes):
        print(f"Loading eQTL files for {chrom}")
        eqtl_table = process_table(
            table=import_table(paths=[str(p) for p in eqtls if f"_{chrom}_" in str(p)], schema=schema),
            reference=reference,
            is_esnp=False,
            verify=verify,
        )

        # Set is_esnp to the value that the matching esnp row contains
        esnps_for_chrom = esnp_table.filter(esnp_table.chrom == chrom.replace("chr", ""))
        association_table = eqtl_table.annotate(is_esnp=hail.is_defined(esnps_for_chrom[eqtl_table.id]))

        if verify:
            # Check that rows have been joined correctly. Correctly means all ensps have been merged with their
            # matching row in the eqtl_table and `is_esnp` is marked as `True`.
            print("Verifying eSNP join")
            # pylint: disable=singleton-comparison
            count_left = association_table.filter(association_table.is_esnp == True).key_by("id").distinct().count()
            count_right = esnps_for_chrom.key_by("id").distinct().count()
            assert count_left == count_right, "some eSNPs have not been marked in the associations table"

        output_path = f"{output_dir}/associations/{chrom}.tsv.gz"
        print(f"Writing output to '{output_path}'")
        association_table.export(
            output=output_path,
            types_file=output_path.replace(f"{chrom}.tsv.gz", "types.txt") if index == 0 else None,
            delimiter="\t",
            header=True,
        )


if __name__ == "__main__":
    hail.init()

    prepare_associations()
