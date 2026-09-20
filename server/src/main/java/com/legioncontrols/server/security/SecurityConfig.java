package com.legioncontrols.server.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Preserves the EXISTING Express authentication/authorization reality first (see AGENTS.md and the
 * Phase 4 inspection notes): the Node backend has no authentication system at all today — no JWT,
 * no session, no API key, on any route except the LS-100 deployment endpoints' shared-secret
 * bearer-token gate (backend/src/modules/deployment/deployment.auth.js), which is not yet
 * reproduced here because those endpoints haven't migrated to Spring.
 *
 * This class exists so the framework is properly wired (password encoder, explicit filter chain,
 * no default generated-password login) rather than left to Spring Boot's insecure-by-default
 * auto-configuration — but it deliberately does NOT invent new authentication. Tightening this to
 * real per-request identity (matching {@code UserSiteAccess}'s per-site role model) is real,
 * separate future work, not a Phase 4 migration-parity concern.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable());
        return http.build();
    }

    /** Matches Express's app-wide {@code cors()} call (no origin/method/header restrictions). */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Ready for when real password-based auth is introduced; unused while no login exists. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
