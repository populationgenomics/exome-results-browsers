import pandas as pd

from data_pipeline.datasets.tob.helpers import build_analaysis_input_path, build_output_path


def prepare_cell_metadata():
    table = pd.read_table(
        f"{build_analaysis_input_path()}/cell_types_metadata.csv",
        header=0,
        sep=",",
    )

    table.to_csv(
        f"{build_output_path()}/metadata/cell_types.tsv",
        mode="w",
        sep="\t",
        header=True,
        index=False,
    )


if __name__ == "__main__":
    prepare_cell_metadata()
