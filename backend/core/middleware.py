class PermissionsPolicyMiddleware:
    """
    Sets Permissions-Policy header to allow 'unload' event in modern Chromium browsers,
    silencing Chrome's [Violation] Permissions policy violation: unload is not allowed
    emitted by Django Admin's RelatedObjectLookups.js.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.headers['Permissions-Policy'] = 'unload=*'
        return response
