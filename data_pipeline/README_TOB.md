# Running the ingestion CLI

The `tob.py` file contains a multi-command CLI to ingest data from various sources into a BigQuery dataset to be used by the browser. After cloning this project and creating the conda environment, cd into `/data_pipeline` (assuming you are in the repository's root folder). Here are some usage examples:

```bash
#!/bin/bash
set –e

python tob.py --help

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    eqtl-association \
        --bucket cpg-tob-wgs-main \
        --input-dir gs://cpg-tob-wgs-main/scrna-seq/eqtl_output/v3/

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    cell-type \
        --input-file gs://path-to-cell-type-metadata-file

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    expression \
        --input-file gs://path-to-expression-parquet

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    eqtl-effect \
        --input-file gs://path-to-eqtl-expression-effect-parquet

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    gene-model \
        --hgnc-file gs://cpg-tob-wgs-browser-dev/reference/hgnc.tsv \
        --gencode-file gs://cpg-tob-wgs-browser-dev/reference/grch38/gencode.v41.annotation.gtf.gz \
        --canonical-transcripts-file gs://cpg-tob-wgs-browser-dev/reference/grch38/reference_grch38_canonical_transcripts.tsv.gz

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1
    --reference GRCh38 \
    post-process
```

The `post-process` step should be run last, but the other steps can be run in any order. You will need to run this with the `tob-wgs-browser` project set in your environment and using a service account that has read access to `tob-wgs` cloud storage buckets.

# Debugging tips

- The method which lists eqtl association files in `/data_pipeline/data_pipeline/datasets/tob/tables/association.py` is not tested and will likely need to be modified to correctly pick up the correlation results parquet files.

- `project-id` is only used in the `post-process` step to create BigQuery table identifiers. The rest of the commands infer the project identifier from the environment's credentials. This is currently a `FIXME`. Make sure your environment is using `tob-wgs-browser` as its project using `glcoud config set project tob-wgs-browser` before running this CLI.

- Make sure the same gencode annotations file is used between the analysis pipeline and this ingestion CLI to ensure consistent gene identifiers and transcripts.
