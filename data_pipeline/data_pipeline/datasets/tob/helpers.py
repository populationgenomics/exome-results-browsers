from google.cloud import bigquery

from data_pipeline.config import pipeline_config


PROJECT = "TOB"


def get_gcp_bucket_name():
    return "cpg-tob-wgs-browser-dev"


def get_bq_dataset_id():
    return pipeline_config.get(PROJECT, "bq_dataset_id")


def get_reference_genome():
    return pipeline_config.get(PROJECT, "reference").lower()


def build_analaysis_input_path(absolute_path=True):
    reference = pipeline_config.get(PROJECT, "reference").lower()
    dataset = pipeline_config.get(PROJECT, "dataset")
    bucket = pipeline_config.get(PROJECT, "bucket")

    prefix = f"gs://{bucket}/"

    return (
        pipeline_config.get(PROJECT, "input_directory")
        .replace(":bucket", bucket)
        .replace(":reference", reference)
        .replace(":dataset", dataset)
        .replace(prefix, prefix if absolute_path else "")
    )


def get_biq_query_client():
    return bigquery.Client(location=pipeline_config.get(PROJECT, "bq_location"))


def build_output_path(absolute_path=True):
    reference = pipeline_config.get(PROJECT, "reference").lower()
    dataset = pipeline_config.get(PROJECT, "dataset")
    bucket = pipeline_config.get(PROJECT, "bucket")

    prefix = f"gs://{bucket}/"

    return (
        pipeline_config.get(PROJECT, "output_directory")
        .replace(":bucket", bucket)
        .replace(":reference", reference)
        .replace(":dataset", dataset)
        .replace(prefix, prefix if absolute_path else "")
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


CHROM_LENGTHS = {
    "grch37": {
        "chr1": 249250621,
        "chr2": 243199373,
        "chr3": 198022430,
        "chr4": 191154276,
        "chr5": 180915260,
        "chr6": 171115067,
        "chr7": 159138663,
        "chr8": 146364022,
        "chr9": 141213431,
        "chr10": 135534747,
        "chr11": 135006516,
        "chr12": 133851895,
        "chr13": 115169878,
        "chr14": 107349540,
        "chr15": 102531392,
        "chr16": 90354753,
        "chr17": 81195210,
        "chr18": 78077248,
        "chr19": 59128983,
        "chr20": 63025520,
        "chr21": 48129895,
        "chr22": 51304566,
        "chrX": 155270560,
        "chrY": 59373566,
    },
    "grch38": {
        "chr1": 248956422,
        "chr2": 242193529,
        "chr3": 198295559,
        "chr4": 190214555,
        "chr5": 181538259,
        "chr6": 170805979,
        "chr7": 159345973,
        "chr8": 145138636,
        "chr9": 138394717,
        "chr10": 133797422,
        "chr11": 135086622,
        "chr12": 133275309,
        "chr13": 114364328,
        "chr14": 107043718,
        "chr15": 101991189,
        "chr16": 90338345,
        "chr17": 83257441,
        "chr18": 80373285,
        "chr19": 58617616,
        "chr20": 64444167,
        "chr21": 46709983,
        "chr22": 50818468,
        "chrX": 156040895,
        "chrY": 57227415,
    },
}


def get_chrom_offsets():
    offsets = {k: {} for k in CHROM_LENGTHS}

    for reference in offsets.keys():
        for (index, _) in enumerate(CHROM_LENGTHS[reference]):
            offset = sum(list(CHROM_LENGTHS[reference].values())[0:index])
            offsets[reference][index + 1] = offset

    return offsets


CHROM_OFFSETS = get_chrom_offsets()


def local_to_global_coordinates(pos, chrom, reference="grch37"):
    if isinstance(chrom, str):
        chrom = int(chrom.replace("chr", ""))

    # Hail subtracts 1 to make global coordinates 0-based. We need to
    # stay consistent with this behaviour so here we substract 1 too.
    offset = CHROM_OFFSETS[reference][int(chrom)] - 1
    return pos + offset
