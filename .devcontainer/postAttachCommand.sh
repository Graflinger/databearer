pip install --upgrade pip
pip3 install -r ./requirements.txt


DUCKDB_VERSION=v1.1.2
echo $DUCKDB_VERSION

wget https://github.com/duckdb/duckdb/releases/download/${DUCKDB_VERSION}/duckdb_cli-linux-amd64.zip
clear
file duckdb_cli-linux-amd64.zip
unzip duckdb_cli-linux-amd64.zip
file duckdb

sudo mkdir /opt/duckdb
sudo cp duckdb /opt/duckdb
sudo chmod +x /opt/duckdb/duckdb
sudo ln -s /opt/duckdb/duckdb /usr/bin/duckdb

cd
rm duckdb duckdb_cli-linux-amd64.zip
