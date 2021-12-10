#!/usr/bin/env python3
# coding: utf-8

import hail

from data_pipeline.datasets.tob.create_tables import create_tables
from data_pipeline.datasets.tob.prepare_associations import prepare_associations
from data_pipeline.datasets.tob.prepare_cell_metadata import prepare_cell_metadata
from data_pipeline.datasets.tob.prepare_gene_models import prepare_gene_models
from data_pipeline.datasets.tob.prepare_log_residuals import prepare_log_residuals


def run_pipeline(verify=True, skip_processing=False, delete_existing_tables=True):
    if not skip_processing:
        hail.init()
        prepare_gene_models()
        prepare_associations(verify)
        prepare_log_residuals()
        prepare_cell_metadata()

    create_tables(delete_existing_tables)


if __name__ == "__main__":
    run_pipeline()
