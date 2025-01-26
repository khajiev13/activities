from neomodel import db
import time
import logging

logger = logging.getLogger('neo4j.queries')

class Neo4jLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        db.cypher_query = self._log_query(db.cypher_query)
        return None

    def _log_query(self, original_query):
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
#                 logger.info(f"Params: {args}")
                result = original_query(*args, **kwargs)
                duration = time.time() - start
                logger.info(f"Neo4j Query: {args[0]}")
                # logger.info(f"Parameters: {args[1]}")
                logger.info(f"Duration: {duration:.2f}s")
                return result
            except Exception as e:
                logger.error(f"Query failed: {str(e)}")
                raise
        return wrapper