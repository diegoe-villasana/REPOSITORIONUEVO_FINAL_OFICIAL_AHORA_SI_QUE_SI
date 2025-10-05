
import json
import os

# with open("meteorites_data.json", "r", encoding= "utf-8") as f:
#     datos = json.load(f)
#     meteoro = datos["neos"]
#     for metodo in datos["neos"]:
#         print(metodo["name"])


# Obtener la carpeta raíz del proyecto (donde está app.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # carpeta Controllers
ROOT_DIR = os.path.dirname(BASE_DIR)                  # sube un nivel a la raíz
JSON_PATH = os.path.join(ROOT_DIR, "meteorites_data.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    datos = json.load(f)


def Listameteoros():
    names = []
    for metodo in datos["neos"]:
        names.append(metodo["name"])  
    return names  # Regresa la lista, no hagas json.dumps aquí


def infoasteroide(name):
    for metodo in datos["neos"]:
        if name == metodo["name"]:
            return metodo

def velocidad(name):
    for metodo in datos["neos"]:
        if name == metodo["name"]:
            return metodo

def todos(name):
    for metodo in datos["neos"]:
        if name == metodo["name"]:
            return metodo

def lista_mayor_impacto():
    lista = datos["neos"][:]
    for i in range(1, len(lista)):
        key = lista[i]
        j = i - 1
        while j >= 0 and lista[j]["impact"] < key["impact"]:
            lista[j + 1] = lista[j]
            j -= 1
        lista[j + 1] = key
    
    top5 = lista[:5]
    return json(top5)





    
