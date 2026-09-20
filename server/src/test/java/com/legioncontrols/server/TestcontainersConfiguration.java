package com.legioncontrols.server;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	// Pinned to 16 to match the Postgres version this schema/jOOQ codegen was validated against
	// (see build.gradle's jOOQ codegen datasource) — "latest" would silently drift.
	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		PostgreSQLContainer container = new PostgreSQLContainer(DockerImageName.parse("postgres:16"));
		container.start();
		// Apply the EXISTING Prisma-managed schema before Spring's own Flyway/jOOQ/JPA connect —
		// see PrismaSchemaInitializer's class comment. Flyway then baselines on top of it exactly as
		// it would against a real freshly-provisioned database.
		PrismaSchemaInitializer.apply(container);
		return container;
	}

}
