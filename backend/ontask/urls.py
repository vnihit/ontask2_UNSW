"""ontask URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.11/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.conf.urls import url, include
    2. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url
from django.urls import include, path
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
import os

from rest_framework import routers

from container.views import ContainerViewSet
from datasource.views import DatasourceViewSet
from datalab.views import DatalabViewSet
from action.views import ActionViewSet
from audit.views import AuditViewSet

router = routers.DefaultRouter()
router.register("container", ContainerViewSet, "container")
router.register("datasource", DatasourceViewSet, "datasource")
router.register("datalab", DatalabViewSet, "datalab")
router.register("action", ActionViewSet, "action")
router.register("audit", AuditViewSet, "audit")

urlpatterns = [path("auth/", include("accounts.urls"))]

urlpatterns += router.urls

if os.environ.get("ONTASK_DEVELOPMENT"):
    urlpatterns += [path("admin/", admin.site.urls)]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
