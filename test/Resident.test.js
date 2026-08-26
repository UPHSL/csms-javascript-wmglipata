import { describe, test } from 'node:test';
import assert from 'node:assert';
import { Resident, ResidentStatus } from '../src/models/Resident.js';

describe('Resident Domain Model', () => {

    // Test 1: Verify that a Resident can be created using valid Resident information.
    test('should create a Resident with valid information', () => {
        const resident = new Resident(
            '1',
            'Wilmar',
            'Lipata',
            '123 Main St',
            '555-1234',
            'wilmar.lipata@example.com', 
            ResidentStatus.ACTIVE
        );
        
        assert.ok(resident !== undefined, 'Resident should be defined');
        assert.ok(resident instanceof Resident, 'Resident should be an instance of the Resident class');
    });

    // Test 2: Verify that Resident information can be assigned and retrieved correctly.
    test('should accurately assign and retrieve Resident Information', () => {
        const resident = new Resident(
            '2',
            'Charmaine',
            'Tayco',
            '6767 Main St',
            '555-0200',
            'charmaine.tayco@example.com',
            ResidentStatus.ACTIVE
        );
        
        assert.strictEqual(resident.id, '2');
        assert.strictEqual(resident.firstName, 'Charmaine');
        assert.strictEqual(resident.lastName, 'Tayco');
        assert.strictEqual(resident.address, '6767 Main St');
        assert.strictEqual(resident.contactNumber, '555-0200');
        assert.strictEqual(resident.email, 'charmaine.tayco@example.com');
    });

    // Test 3: Verify that the Resident model can represent: Active
    test('should correctly represent the Active status', () => {
        const resident = new Resident(
             '3',
             'Willow',
             'Graham',
             '789 Pine St',
             '555-0300',
             'willow.graham@example.com',
             ResidentStatus.ACTIVE
         );

        assert.strictEqual(resident.status, ResidentStatus.ACTIVE);
        assert.strictEqual(resident.status, 'Active');
    });
});