from data_pipeline.config import pipeline_config


PROJECT = "TOB"


def get_gcp_bucket_name():
    return "cpg-tob-wgs-browser-dev"


def build_analaysis_input_path():
    reference = pipeline_config.get(PROJECT, "reference").lower()
    dataset = pipeline_config.get(PROJECT, "dataset")
    bucket = pipeline_config.get(PROJECT, "bucket")

    return (
        pipeline_config.get(PROJECT, "input_directory")
        .replace(":bucket", bucket)
        .replace(":reference", reference)
        .replace(":dataset", dataset)
    )


def build_output_path():
    reference = pipeline_config.get(PROJECT, "reference").lower()
    dataset = pipeline_config.get(PROJECT, "dataset")
    bucket = pipeline_config.get(PROJECT, "bucket")

    return (
        pipeline_config.get(PROJECT, "output_directory")
        .replace(":bucket", bucket)
        .replace(":reference", reference)
        .replace(":dataset", dataset)
    )


def build_gencode_path():
    reference = pipeline_config.get(PROJECT, "reference").lower()
    bucket = pipeline_config.get(PROJECT, "bucket")

    return pipeline_config.get(PROJECT, "gencode_path").replace(":bucket", bucket).replace(":reference", reference)


def build_canonical_transcripts_path():
    reference = pipeline_config.get(PROJECT, "reference").lower()
    bucket = pipeline_config.get(PROJECT, "bucket")

    return (
        pipeline_config.get(PROJECT, "canonical_transcripts_path")
        .replace(":bucket", bucket)
        .replace(":reference", reference)
    )


def build_hgnc_path():
    bucket = pipeline_config.get(PROJECT, "bucket")

    return pipeline_config.get(PROJECT, "hgnc_path").replace(":bucket", bucket)


def chrom_ord(chrom):
    if chrom in ("X", "Y", "MT"):
        return {"X": 23, "Y": 24, "MT": 25}[chrom]
    return int(chrom)
