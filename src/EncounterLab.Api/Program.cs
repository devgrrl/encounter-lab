using System.Data;
using System.Text.Json.Serialization;
using EncounterLab.Api.GraphQL;
using EncounterLab.Api.Realtime;
using EncounterLab.Application;
using EncounterLab.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var configuredConnectionString = builder.Configuration.GetConnectionString("EncounterLab")
    ?? "Data Source=encounterlab.db";
var connectionStringBuilder = new SqliteConnectionStringBuilder(configuredConnectionString)
{
    DefaultTimeout = 10,
    ForeignKeys = true
};
var connectionString = connectionStringBuilder.ToString();
var brivPath = System.IO.Path.Combine(builder.Environment.ContentRootPath, "Data", "briv.json");
if (!File.Exists(brivPath))
{
    brivPath = System.IO.Path.Combine(AppContext.BaseDirectory, "Data", "briv.json");
}

builder.Services.AddPooledDbContextFactory<EncounterDbContext>(options =>
    options.UseSqlite(connectionString));
builder.Services.AddSingleton<ICharacterSeed>(_ => new FileCharacterSeed(brivPath));
builder.Services.AddSingleton<ICombatStore, SqliteCombatStore>();
builder.Services.AddSingleton<IRandomSource, CryptoRandomSource>();
builder.Services.AddSingleton<CombatService>();
builder.Services.AddSingleton<SignalRCombatNotifier>();
builder.Services.AddSingleton<ICombatNotifier>(services =>
    services.GetRequiredService<SignalRCombatNotifier>());
builder.Services.AddHostedService<SignalRCombatNotifier>(services =>
    services.GetRequiredService<SignalRCombatNotifier>());

builder.Services
    .AddSignalR(options =>
    {
        options.KeepAliveInterval = TimeSpan.FromSeconds(5);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(20);
    })
    .AddJsonProtocol(options =>
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddErrorFilter<CombatErrorFilter>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && uri.Host is "localhost" or "127.0.0.1")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var app = builder.Build();
app.UseCors();
app.UseWebSockets();
app.MapGet("/api/health/live", () => Results.Ok(new
{
    status = "healthy",
    service = "EncounterLab.Api",
    time = DateTimeOffset.UtcNow
}));
app.MapGet("/api/health", async (
    IDbContextFactory<EncounterDbContext> contextFactory,
    CancellationToken cancellationToken) =>
{
    try
    {
        await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
        await context.Database.OpenConnectionAsync(cancellationToken);
        var connection = (SqliteConnection)context.Database.GetDbConnection();
        await using var transaction = connection.BeginTransaction(
            IsolationLevel.Serializable,
            deferred: false);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT COUNT(*) FROM CharacterSnapshots;";
        _ = await command.ExecuteScalarAsync(cancellationToken);
        await transaction.RollbackAsync(cancellationToken);

        return Results.Ok(new
        {
            status = "ready",
            service = "EncounterLab.Api",
            database = "read-write",
            time = DateTimeOffset.UtcNow
        });
    }
    catch (Exception exception)
    {
        app.Logger.LogError(exception, "Database readiness check failed.");
        return Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Encounter Lab is not ready",
            detail: "The SQLite database could not complete a read-write transaction.");
    }
});
app.MapGraphQL("/graphql");
app.MapHub<CombatHub>("/hubs/combat");

await SqliteCombatStore.InitializeAsync(
    app.Services.GetRequiredService<IDbContextFactory<EncounterDbContext>>(),
    app.Services.GetRequiredService<ICharacterSeed>());

await app.RunAsync();

public partial class Program { }
