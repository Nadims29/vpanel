// Note: get, post, put, del and usersApi will be used when backend supports teams

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
    // When backend supports teams, we can use usersApi.listUsers() to get team data
    
    // Extract unique team names from users (if users have teams field)
    // For now, return empty array since backend doesn't support teams yet
    return [];
  } catch (error) {
    console.error('Failed to list teams:', error);
    return [];
  }
}

// Get team by ID
export async function getTeam(_id: string): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Create a new team
export async function createTeam(_data: CreateTeamRequest): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Update team
export async function updateTeam(_id: string, _data: UpdateTeamRequest): Promise<Team> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Delete team
export async function deleteTeam(_id: string): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Add member to team
export async function addTeamMember(_teamId: string, _data: AddMemberRequest): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Remove member from team
export async function removeTeamMember(_teamId: string, _userId: string): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Update member role in team
export async function updateTeamMemberRole(_teamId: string, _data: UpdateMemberRoleRequest): Promise<void> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}

// Get team members
export async function getTeamMembers(_teamId: string): Promise<TeamMember[]> {
  // TODO: Implement when backend supports teams
  throw new Error('Teams not yet supported by backend');
}
