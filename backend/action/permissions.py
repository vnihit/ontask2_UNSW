from rest_framework import permissions

from container.models import Container

class ActionPermissions(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        request_user = request.user.email

        if not obj:
            container = Container.objects.get(id=request.data['container'])
        else:
            container = obj.container

        is_owner = (request_user == container.owner)
        has_access = (request_user in container.sharing)

        if request.method in ['PATCH', 'PUT', 'POST']:
            # Only owners of the object or users given read & write access can update
            return is_owner or has_access
        elif request.method in ['DELETE']:
            # Only owners of the object can delete
            return is_owner
        elif request.method in ['GET']:
            # Only owners or users given read or read & write access can view the object
            return is_owner or has_access
