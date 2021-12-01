#!/usr/bin/env python3
# coding: utf-8

import argparse

from data_pipeline.datasets.tob.pipeline import run_pipeline

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify association ID uniqueness and table joins with eSNPs",
    )

    args = parser.parse_args()

    run_pipeline(verify=args.verify)
