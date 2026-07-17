function assignTeams(players, teams) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const assignment = new Map(teams.map(t => [t.id, []]));
  const teamIds = teams.map(t => t.id);

  shuffled.forEach((player, i) => {
    const teamId = teamIds[i % teamIds.length];
    assignment.get(teamId).push(player);
  });

  return assignment;
}

function getSmallestTeam(teams, members) {
  return teams.reduce((smallest, team) => {
    const count = members.filter(m => m.team_id === team.id).length;
    const smallestCount = members.filter(m => m.team_id === smallest.id).length;
    return count < smallestCount ? team : smallest;
  }, teams[0]);
}

module.exports = { assignTeams, getSmallestTeam };
