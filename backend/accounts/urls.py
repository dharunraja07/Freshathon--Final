from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.login_page, name='login'),
    path('register/', views.register_page, name='register'),
    path('student-dashboard/', views.student_dashboard, name='student_dashboard'),
    path('donor-dashboard/', views.donor_dashboard, name='donor_dashboard'),

    path('api/config/', views.api_config, name='api_config'),
    path('api/register/', views.api_register, name='api_register'),
    path('api/login/', views.api_login, name='api_login'),
    path('api/logout/', views.api_logout, name='api_logout'),
    path('api/me/', views.api_me, name='api_me'),
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('api/users/', views.api_users, name='api_users'),
    path('api/users/promote/', views.api_users_promote, name='api_users_promote'),
    path('api/projects/', views.api_projects, name='api_projects'),
    path('api/projects/<str:project_id>/delete/',
         views.api_project_delete, name='api_project_delete'),
    path('api/projects/<str:project_id>/fund/',
         views.api_project_fund, name='api_project_fund'),
    path('api/messages/', views.api_messages, name='api_messages'),
    path('api/messages/read/', views.api_messages_read, name='api_messages_read'),
]
