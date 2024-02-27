from django.shortcuts import render
from django.http import JsonResponse
from langchain.chains import GraphCypherQAChain
from langchain_community.graphs import Neo4jGraph
from langchain_openai import ChatOpenAI
import os 


def process_message(message):
    graph = Neo4jGraph(
    url= os.getenv('NEO4J_URL'), username=os.getenv('NEO4J_USERNAME'), password=os.getenv('NEO4J_PASSWORD')
    )
    chain = GraphCypherQAChain.from_llm(
    ChatOpenAI(temperature=0), graph=graph, verbose=True
    )
    result = chain.run("Qancha davlatlar bor? Davlatning nomlari nima? O'zbek tilida javob ber.")
    return result

def chatbot_view(request):
    if request.method == 'GET':
        message = request.POST.get('message')
        # Process the message and generate a reply
        reply = process_message(message)
        return JsonResponse({'reply': reply})
