#!/usr/bin/env python3
# coding: utf-8

import argparse

from data_pipeline.datasets.tob.pipeline import run_pipeline

# TODO: Add args and logic for running this job on a dataproc
# TODO: Add support for other Cloud providers

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify association ID uniqueness and table joins with eSNPs",
    )
    parser.add_argument(
        "--skip-processing",
        action="store_true",
        help="Skip processing of analysis output and only perform BigQuery ingestion",
    )
    parser.add_argument(
        "--drop-tables",
        action="store_true",
        help="Drop existing BigQuery tables before ingesting data",
    )

    args = parser.parse_args()

    run_pipeline(
        verify=args.verify,
        skip_processing=args.skip_processing,
        delete_existing_tables=args.drop_tables,
    )
