#!/usr/bin/env python3
# coding: utf-8

import re
import json

import hail
import pandas as pd
from google.cloud import storage

from data_pipeline.config import pipeline_config
from data_pipeline.datasets.tob.helpers import (
    PROJECT,
    chrom_ord,
    get_gcp_bucket_name,
    build_analaysis_input_path,
    build_output_path,
)


def prepare_associations(symbol_to_id_mapping=None, verify=True):
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

    # Create lookup table to update gene ids to most recent.
    if symbol_to_id_mapping is None:
        mapping_file = bucket.get_blob(
            f"{output_dir}/metadata/gene_symbol_to_id.json".replace(f"gs://{bucket.name}/", "")
        )
        symbol_to_id_mapping = json.loads(mapping_file.download_as_string()) if mapping_file else None

    if isinstance(symbol_to_id_mapping, dict):
        symbol_to_id_mapping = hail.Table.from_pandas(
            pd.DataFrame(list(symbol_to_id_mapping.items()), columns=["gene_symbol", "gene_id"])
        ).key_by("gene_symbol")
    elif symbol_to_id_mapping is not None:
        raise TypeError("Parameter 'symbol_to_id_mapping' must be a dict")

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
        symbol_to_id_mapping=symbol_to_id_mapping,
    ).cache()

    for (index, chrom) in enumerate(chromosomes):
        print(f"Loading eQTL files for {chrom}")
        eqtl_table = process_table(
            table=import_table(paths=[str(p) for p in eqtls if f"_{chrom}_" in str(p)], schema=schema),
            reference=reference,
            is_esnp=False,
            verify=verify,
            symbol_to_id_mapping=symbol_to_id_mapping,
        )

        # Set is_esnp to the value that the matching esnp row contains
        esnps_for_chrom = esnp_table.filter(esnp_table.chrom == chrom.replace("chr", ""))
        association_table = eqtl_table.annotate(is_esnp=hail.is_defined(esnps_for_chrom[eqtl_table.association_id]))

        if verify:
            # Check that rows have been joined correctly. Correctly means all ensps have been merged with their
            # matching row in the eqtl_table and `is_esnp` is marked as `True`.
            print("Verifying eSNP join")
            # pylint: disable=singleton-comparison
            count_left = (
                association_table.filter(association_table.is_esnp == True).key_by("association_id").distinct().count()
            )
            count_right = esnps_for_chrom.key_by("association_id").distinct().count()
            assert count_left == count_right, "some eSNPs have not been marked in the associations table"

        output_path = f"{output_dir}/associations/{chrom}.tsv.gz"
        print(f"Writing output to '{output_path}'")
        association_table.export(
            output=output_path,
            types_file=output_path.replace(f"{chrom}.tsv.gz", "types.txt") if index == 0 else None,
            delimiter="\t",
            header=True,
        )


def import_table(paths, schema=None):
    return hail.import_table(paths, types=schema, impute=not schema)


def process_table(table, reference="grch37", is_esnp=False, verify=True, symbol_to_id_mapping=None):
    result = table.transmute(BP=hail.int32(table.BP))

    result = result.annotate(
        variant=hail.parse_variant(
            hail.str(":").join([hail.str(result.CHR), hail.str(result.BP), result.A1, result.A2]),
            reference_genome=reference,
        )
    )

    if symbol_to_id_mapping:
        print("Mapping gene symbols to latest stable Ensembl gene identifies")
        result = result.annotate(ENSEMBL_GENE_ID=symbol_to_id_mapping[result.GENE].gene_id)

    result = result.annotate(
        is_esnp=hail.bool(is_esnp),
        global_bp=result.variant.locus.global_position(),
        variant_id=hail.str("-").join(
            [
                hail.str(result.CHR),
                hail.str(result.BP),
                result.A1,
                result.A2,
            ]
        ),
        association_id=hail.str(":").join(
            [
                hail.str(result.CHR),
                hail.str(result.BP),
                result.A1,
                result.A2,
                result.ENSEMBL_GENE_ID,
                result.db_key,
                hail.str(result.ROUND),
            ]
        ),
    )

    if verify:
        print("Verifying ID uniqueness")
        assert (
            result.count() == result.key_by("association_id").distinct().count()
        ), "id column contains duplicate values"

    result = result.rename({"db_key": "cell_type_id"})
    result = result.rename({"cell_type": "cell_type_name"})
    result = result.rename({"CHR": "chrom"})
    result = result.rename({"SNPID": "snp_id"})
    result = result.rename({"ENSEMBL_GENE_ID": "gene_id"})
    result = result.rename({"GENE": "gene_symbol"})
    result = result.rename({"S_STATISTICS": "s_statistic"})
    result = result.rename({c: c.lower() for c in list(result.row.keys())})

    # Drop field "variant" so don't include in column order array
    column_order = [
        "association_id",
        "cell_type_id",
        "cell_type_name",
        "gene_id",
        "gene_symbol",
        "rsid",
        "variant_id",
        "snp_id",
        "chrom",
        "bp",
        "global_bp",
        "a1",
        "a2",
        "a2_freq_onek1k",
        "a2_freq_hrc",
        "spearmans_rho",
        "s_statistic",
        "p_value",
        "q_value",
        "fdr",
        "rsquare",
        "genotyped",
        "round",
        "is_esnp",
    ]

    result = result.select(*column_order)
    assert len(set(column_order)) == len(set(result.row.keys()))

    return result.order_by("global_bp").key_by("association_id").distinct()


if __name__ == "__main__":
    hail.init()

    prepare_associations()
