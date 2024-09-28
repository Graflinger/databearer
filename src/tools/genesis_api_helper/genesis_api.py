import requests as req

from src.credentials import user

print(user)
req.get("https://api.genesiscloud.com/v1/instances", headers="HEADERS")