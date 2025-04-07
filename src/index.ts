import { getUserInputs } from './inputHandler';
import { validateInputs } from './validators';
import { renderTemplates } from './templateEngine';
import { writeOutputFiles } from './outputGenerator';
import { generateHash } from './hashGenerator';
import { showWelcomeMessage } from './utils';

async function main(): Promise<void> {
    // Mostrar mensaje de bienvenida y breve descripción del proceso.
    showWelcomeMessage();
    try {
        // 1. Recopilar datos mediante el módulo de inputs.
        const inputs = await getUserInputs();
        
        // 2. Validar los datos ingresados.
        validateInputs(inputs);
    
        // 3. Renderizar las plantillas de Solidity con los datos recopilados.
        const generatedFiles = renderTemplates(inputs);
    
        // 4. Escribir los archivos de salida en la carpeta del cliente.
        // Se usa "clientName" o se toma el tokenName si no se especifica.
        const clientName: string = inputs.clientName || inputs.tokenName;
        writeOutputFiles(clientName, generatedFiles, inputs);
    
        // 5. Generar y mostrar el hash del contrato para comprobación de integridad.
        const contractHash = generateHash(generatedFiles.contract);
        console.log("Generated contract hash:", contractHash);
    
        // 6. (Opcional) Desplegar el contrato o generar informes.
        // await deployContract(generatedFiles.contract, []); // Implementar según sea necesario.
    
        console.log("The process completed successfully.");
      } catch (error) {
        console.error("Error during execution:", error);
      }
    
}
main();