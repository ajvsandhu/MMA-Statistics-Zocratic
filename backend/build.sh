#!/usr/bin/env bash
# exit on error
set -o errexit


pip install --upgrade pip
pip install -r requirements.txt


python -c "import sklearn; print(f'scikit-learn version: {sklearn.__version__}')"
python -c "import numpy; print(f'numpy version: {numpy.__version__}')"
python -c "import joblib; print(f'joblib version: {joblib.__version__}')" 