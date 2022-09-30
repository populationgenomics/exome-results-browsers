# Running the ingestion CLI

The `tob.py` file contains a multi-command CLI to ingest data from various sources into a BigQuery dataset to be used by the browser. After cloning this project and creating the conda environment, cd into `/data_pipeline` (assuming you are in the repository's root folder). Here are some usage examples:

```bash
#!/bin/bash
set –e

python tob.py --help

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    eqtl-association \
        --input-dir gs://cpg-tob-wgs-main/scrna-seq/eqtl_output/v3/

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    eqtl-effect \
        --input-dir gs://cpg-tob-wgs-main/scrna-seq/eqtl_output/v3/

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    cell-type \
        --input-file gs://bucket-name/path-to-cell-type-metadata-file

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    expression \
        --input-file gs://bucket-name/path-to-expression-parquet

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    gene-model \
        --hgnc-file gs://cpg-tob-wgs-browser-dev/reference/hgnc.tsv \
        --gencode-file gs://cpg-tob-wgs-browser-dev/reference/grch38/gencode.v41.annotation.gtf.gz \
        --canonical-transcripts-file gs://cpg-tob-wgs-browser-dev/reference/grch38/reference_grch38_canonical_transcripts.tsv.gz

python tob.py \
    --dataset-id grch38 \
    --project-id tob-wgs-browser \
    --location australia-southeast1 \
    --reference GRCh38 \
    post-process
```

The `post-process` step should be run last, but the other steps can be run in any order. You will need to run this with the `tob-wgs-browser` project set in your environment and using a service account that has read access to `tob-wgs` cloud storage buckets.

# Debugging tips

- The command which ingests eqtl association files (see source `/data_pipeline/data_pipeline/datasets/tob/tables/association.py`) is not tested and will likely need to be modified to correctly pick up the correlation results parquet files for rounds 1 through to 5. Rounds 2-5 may exist in a different sub-folder among other parquet files (ie gene expression) that should be ignored.

- `project-id` is only used in the `post-process` step to create BigQuery table identifiers. The rest of the commands infer the project identifier from the environment's credentials - this is currently a `FIXME`. Before running, make sure your environment is configured to use the `tob-wgs-browser` project using `glcoud config set project tob-wgs-browser`.

- Make sure the same gencode annotations file is used between the analysis pipeline and this ingestion CLI to ensure consistent gene identifiers and transcripts.

- It will be easier to make changes to the API code to conform to the data structures requiredf by the browser because the server is stateless, and the front-end is more complex becuase of state management.

- The previous database was based on GRCh37. In GRCh38, chromomsome identifiers also include the 'chr' prefix. This will likely cause bugs so if you see any 404's that should not be happening check the SQL query to see if the `chrom` column is causing an issue in lookups. These should be mostly fixed, but one or two issues might remain.

# Known Issues

- The coordinates of associations don't seem to line up with their related gene. See `variant/22-25180036-TCTGAAAGAGGCAAGACCTGGTGCTCTGGAGCCCTTGGGCTACCCGAGGAA-T` and set `cell type` to `b_intermediate` and `fdr` to `0.9`. The associations are to the right of the gene.

- Misc. rendering and performance issues for edge cases.

- Gene expression and eQTL effect plots appear to be bi-modal and make the overlayed box plots an awkward visualisation.

- Cell type expression and eQTL effect violin plot components will not render x-axis ticks with missing data.
