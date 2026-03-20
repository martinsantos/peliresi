// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SitrepRegistry - Registro inmutable de manifiestos de residuos peligrosos
/// @notice Almacena hashes SHA-256 de manifiestos firmados en la blockchain
/// @dev Desplegado en Ethereum Sepolia para SITREP Mendoza
contract SitrepRegistry {
    address public owner;

    // hash del manifiesto => timestamp de registro
    mapping(bytes32 => uint256) private hashes;

    event ManifiestoRegistrado(bytes32 indexed hash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "No autorizado");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Registra un hash de manifiesto en la blockchain
    /// @param hash SHA-256 del manifiesto canonico
    function registrar(bytes32 hash) external onlyOwner {
        require(hashes[hash] == 0, "Hash ya registrado");
        hashes[hash] = block.timestamp;
        emit ManifiestoRegistrado(hash, block.timestamp);
    }

    /// @notice Verifica si un hash existe en el registro
    /// @param hash SHA-256 a verificar
    /// @return exists true si el hash fue registrado
    /// @return timestamp momento del registro (0 si no existe)
    function verificar(bytes32 hash) external view returns (bool exists, uint256 timestamp) {
        uint256 ts = hashes[hash];
        return (ts > 0, ts);
    }
}
