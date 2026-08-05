using Microsoft.EntityFrameworkCore;

namespace EncounterLab.Infrastructure;

public sealed class EncounterDbContext(DbContextOptions<EncounterDbContext> options)
    : DbContext(options)
{
    public DbSet<CharacterSnapshotEntity> CharacterSnapshots => Set<CharacterSnapshotEntity>();
    public DbSet<CombatEventEntity> CombatEvents => Set<CombatEventEntity>();
    public DbSet<ProcessedCommandEntity> ProcessedCommands => Set<ProcessedCommandEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CharacterSnapshotEntity>(entity =>
        {
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasMaxLength(64);
            entity.Property(item => item.Json).IsRequired();
        });

        modelBuilder.Entity<CombatEventEntity>(entity =>
        {
            entity.HasKey(item => item.Sequence);
            entity.Property(item => item.Sequence).ValueGeneratedNever();
            entity.Property(item => item.CharacterId).HasMaxLength(64);
            entity.HasIndex(item => item.EventId).IsUnique();
            entity.HasIndex(item => new { item.CharacterId, item.Sequence });
            entity.HasIndex(item => new { item.CharacterId, item.CharacterVersion }).IsUnique();
            entity.Property(item => item.Json).IsRequired();
        });

        modelBuilder.Entity<ProcessedCommandEntity>(entity =>
        {
            entity.HasKey(item => new { item.CharacterId, item.CommandId });
            entity.Property(item => item.CharacterId).HasMaxLength(64);
            entity.Property(item => item.CommandId).HasMaxLength(128);
            entity.Property(item => item.RequestFingerprint).IsRequired();
            entity.Property(item => item.ResultJson).IsRequired();
            entity.HasIndex(item => item.ProcessedAt);
        });
    }
}

public sealed class CharacterSnapshotEntity
{
    public required string Id { get; set; }
    public required string Json { get; set; }
    public int Version { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class CombatEventEntity
{
    public long Sequence { get; set; }
    public required string EventId { get; set; }
    public required string CharacterId { get; set; }
    public int CharacterVersion { get; set; }
    public required string Json { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
}

public sealed class ProcessedCommandEntity
{
    public required string CharacterId { get; set; }
    public required string CommandId { get; set; }
    public required string RequestFingerprint { get; set; }
    public required string ResultJson { get; set; }
    public DateTimeOffset ProcessedAt { get; set; }
}
