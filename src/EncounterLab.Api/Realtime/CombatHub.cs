using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.SignalR;

namespace EncounterLab.Api.Realtime;

[ExcludeFromCodeCoverage(Justification =
    "SignalR connection lifecycle hook; exercising it meaningfully needs a live " +
    "HubConnection against a TestServer, not a unit test. The commit/broadcast " +
    "logic it enables (SignalRCombatNotifier) is covered separately.")]
public sealed class CombatHub : Hub
{
    public const string BrivGroup = "encounter:briv";

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, BrivGroup);
        await Clients.Caller.SendAsync(
            "connectionReady",
            new { connectionId = Context.ConnectionId, characterId = "briv" });
        await base.OnConnectedAsync();
    }
}
