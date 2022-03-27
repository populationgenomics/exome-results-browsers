#!/usr/bin/env python3
# coding: utf-8

import hail

from data_pipeline.config import pipeline_config

from data_pipeline.datasets.tob.create_tables import create_tables
from data_pipeline.datasets.tob.prepare_associations import prepare_associations
from data_pipeline.datasets.tob.prepare_cell_metadata import prepare_cell_metadata
from data_pipeline.datasets.tob.prepare_gene_models import prepare_gene_models
from data_pipeline.datasets.tob.prepare_expression import prepare_expression
from data_pipeline.datasets.tob.prepare_genotypes import prepare_genotypes
from data_pipeline.datasets.tob.helpers import PROJECT


def run_pipeline(verify=True, skip_processing=False, delete_existing_tables=True):
    reference = pipeline_config.get(PROJECT, "reference").lower()

    if not skip_processing:
        hail.init()

        # TODO: Update gene symbol and ids in assocation files #pylint: disable=fixme
        symbol_to_id_mapping = prepare_gene_models()
        global_coordinate_lookup = prepare_associations(verify)

        prepare_expression(symbol_mapping=symbol_to_id_mapping)
        prepare_genotypes(global_coordinate_lookup=global_coordinate_lookup, reference_genome=reference)
        prepare_cell_metadata()

    create_tables(delete_existing_tables)


if __name__ == "__main__":
    run_pipeline()
