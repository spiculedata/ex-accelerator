import os

# The app's origin; a trailing slash would silently break CORS, so strip it
app_origin = os.environ.get("JUPYTER_ALLOW_ORIGIN", "").rstrip("/")

c.ServerApp.allow_origin = app_origin
c.ServerApp.tornado_settings = {
    "headers": {"Content-Security-Policy": "frame-ancestors 'self' " + app_origin}
}
c.ServerApp.allow_remote_access = True
c.ServerApp.ip = "0.0.0.0"
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.root_dir = "/app/notebooks"
