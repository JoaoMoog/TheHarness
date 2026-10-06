using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SpeedCode — API de exemplo",
        Version = "v1",
        Description = "Use Try it out para testar os endpoints locais."
    });
});
var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("v1/swagger.json", "SpeedCode API v1"));
}
app.MapGet("/", () => "SpeedCode .NET launch validation OK")
    .WithName("Inicio")
    .WithSummary("Verificar se a API está respondendo");
app.MapGet("/health", () => TypedResults.Ok(new HealthResponse("ok", "SpeedCode Example")))
    .WithName("Health")
    .WithSummary("Consultar a saúde da API");
app.Run();

record HealthResponse(string Status, string Application);
