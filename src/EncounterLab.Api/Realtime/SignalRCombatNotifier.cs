using System.Threading.Channels;
using EncounterLab.Api.Contracts;
using EncounterLab.Application;
using Microsoft.AspNetCore.SignalR;

namespace EncounterLab.Api.Realtime;

public sealed class SignalRCombatNotifier(
    IHubContext<CombatHub> hubContext,
    ILogger<SignalRCombatNotifier> logger) : BackgroundService, ICombatNotifier
{
    private const int QueueCapacity = 256;
    private static readonly TimeSpan BroadcastTimeout = TimeSpan.FromSeconds(3);
    private readonly Channel<CombatResult> queue = Channel.CreateBounded<CombatResult>(
        new BoundedChannelOptions(QueueCapacity)
        {
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false,
            FullMode = BoundedChannelFullMode.Wait
        });

    public Task PublishCommittedAsync(
        CombatResult result,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!queue.Writer.TryWrite(result))
        {
            logger.LogWarning(
                "The SignalR broadcast queue was full; committed event {EventId} will be recovered by client reconciliation.",
                result.Event.Id);
        }
        return Task.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var result in queue.Reader.ReadAllAsync(stoppingToken))
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            timeout.CancelAfter(BroadcastTimeout);

            try
            {
                await hubContext.Clients
                    .Group(CombatHub.BrivGroup)
                    .SendAsync(
                        "combatEventCommitted",
                        CombatResultPayload.From(result),
                        timeout.Token);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    "Broadcast of committed event {EventId} exceeded {TimeoutSeconds} seconds. Clients will reconcile from the durable snapshot.",
                    result.Event.Id,
                    BroadcastTimeout.TotalSeconds);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Committed event {EventId} could not be broadcast to SignalR clients. Clients will reconcile from the durable snapshot.",
                    result.Event.Id);
            }
        }
    }
}
