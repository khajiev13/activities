from langchain.chains import GraphCypherQAChain
from langchain_community.graphs import Neo4jGraph
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
import os


def process_message(message):
    graph = Neo4jGraph(
        url=os.getenv('NEO4J_BOLT_URL'), username=os.getenv('NEO4J_USERNAME'), password=os.getenv('NEO4J_PASSWORD')
    )

    CYPHER_GENERATION_TEMPLATE = """You are an expert Neo4j Cypher translator who understands the question in english and convert to Cypher strictly based on the Neo4j Schema provided and following the instructions below:
    1. Generate Cypher query compatible ONLY for Neo4j Version 5
    2. Do not use EXISTS, SIZE keywords in the cypher. Use alias when using the WITH keyword
    3. Use only Nodes and relationships mentioned in the schema
    4. Always enclose the Cypher output inside 3 backticks
    5. Always do a case-insensitive and fuzzy search for any properties related search. Eg: to search for a USER name use `toLower(c.name) contains 'roma'`
    6. Strictly always assume that all the capital cities in the world are in STATE label not in CITY! Eg: "Beijing", "Tashkent", Moscow" they all are in STATE node not in CITY node.
    7. Always use aliases to refer the node in the query
    8. Cypher is NOT SQL. So, do not mix and match the syntaxes
    9. Users have first_name and last_name properties. Full names can be referred to them.
    Schema:
    {schema}

    Question: {question}
    Answer:

    """
    #     Samples:
    # Question: Tell me about activities in Beijing
    # Answer: MATCH (a:ACTIVITY)-[:STATE_BASED_IN]->(state:STATE)

    CYPHER_GENERATION_PROMPT = PromptTemplate(
        input_variables=["schema", "question"], template=CYPHER_GENERATION_TEMPLATE
    )

    chain = GraphCypherQAChain.from_llm(
        ChatOpenAI(temperature=0),
        graph=graph,
        verbose=True,
        cypher_prompt=CYPHER_GENERATION_PROMPT,
        return_intermediate_steps=True
    )
    result = chain.run(message)
    return result


class ChatbotView(APIView):
    # authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message')
        # Process the message and generate a reply
        reply = process_message(message)
        return Response({'reply': reply})
