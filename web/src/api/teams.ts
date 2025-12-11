import { get, post, put, del } from './client';
import * as usersApi from './users';

// Team interface
export interface Team {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  members: TeamMember[];
  resources: string[];
  createdAt: string;
  createdBy: string;
}

// Team member interface
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  avatar?: string;
}

// Create team request
export interface CreateTeamRequest {
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

// Update team request
export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

// Add member request
export interface AddMemberRequest {
  userId: string;
  role?: 'Owner' | 'Admin' | 'Member';
}

// Update member role request
export interface UpdateMemberRoleRequest {
  userId: string;
  role: 'Owner' | 'Admin' | 'Member';
}

// List all teams
export async function listTeams(): Promise<Team[]> {
  try {
    // TODO: Implement when backend supports teams
    // For now, return empty array or build from user data if teams field exists
    const users = await usersApi.listUsers();
    
    // Extract unique team names from users (if users have teams field)
    // For now, return empty array since backend doesn't support teams yet
    return [];
  } catch (error) {
    console.error('Failed to list teams:', error);
    return [];
  }
}

// Get team by ID
export async function getTeam(id: string): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Create a new team
export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Update team
export async function updateTeam(id: string, data: UpdateTeamRequest): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Delete team
export async function deleteTeam(id: string): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Add member to team
export async function addTeamMember(teamId: string, data: AddMemberRequest): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Remove member from team
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Update member role in team
export async function updateTeamMemberRole(teamId: string, data: UpdateMemberRoleRequest): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Get team members
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}
