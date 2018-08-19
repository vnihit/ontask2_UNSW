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
from django.conf.urls import url, include
from django.contrib import admin

from rest_framework import routers
from rest_framework.authtoken import views

from container.views import ContainerViewSet
from datasource.views import DatasourceViewSet
from datalab.views import DatalabViewSet
from action.views import ActionViewSet
from audit.views import AuditViewSet

import accounts.urls

# this is DRF router for REST API viewsets
router = routers.DefaultRouter()

# register REST API endpoints with DRF router
router.register(r'container', ContainerViewSet, r"container")
router.register(r'datasource', DatasourceViewSet, r"datasource")
router.register(r'datalab', DatalabViewSet, r"datalab")
router.register(r'action', ActionViewSet, r"action")
router.register(r'audit', AuditViewSet, r"audit")

urlpatterns = [
    url(r'^api/', include((router.urls, 'api'), namespace='api')),
    url(r'^admin/', admin.site.urls),
    url(r'^token/', views.obtain_auth_token),
    url(r'^api/', include((accounts.urls, 'accounts'), namespace='accounts')),
]
