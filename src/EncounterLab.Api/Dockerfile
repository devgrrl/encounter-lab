FROM mcr.microsoft.com/dotnet/sdk:10.0.302 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY src/EncounterLab.Domain/EncounterLab.Domain.csproj src/EncounterLab.Domain/
COPY src/EncounterLab.Application/EncounterLab.Application.csproj src/EncounterLab.Application/
COPY src/EncounterLab.Infrastructure/EncounterLab.Infrastructure.csproj src/EncounterLab.Infrastructure/
COPY src/EncounterLab.Api/EncounterLab.Api.csproj src/EncounterLab.Api/
RUN dotnet restore src/EncounterLab.Api/EncounterLab.Api.csproj
COPY src/ ./src/
RUN dotnet publish src/EncounterLab.Api/EncounterLab.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.10 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EncounterLab.Api.dll"]
